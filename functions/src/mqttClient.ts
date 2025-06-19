
import * as mqtt from "mqtt";
import type { MqttClient, IClientOptions, ISubscriptionGrant, IPublishPacket } from "mqtt";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getMqttConfig } from "./config";
import type { RealtimeDatabaseMessageEntry, MqttMessagePayload } from "./interfaces";

let client: MqttClient | null = null;
let connectionPromise: Promise<MqttClient> | null = null;
let isConnected = false;
let isConnecting = false;

const mqttConfig = getMqttConfig();

const sanitizeFirebaseKey = (key: string) => {
  return key.replace(/[.#$[\]]/g, '_');
};

function validateAndParseMessage(topic: string, payloadBuffer: Buffer): MqttMessagePayload | null {
  try {
    const messageString = payloadBuffer.toString();
    const parsedPayload: MqttMessagePayload = JSON.parse(messageString);

    if (parsedPayload.command === "set_schedule_part") {
        if (parsedPayload.part === undefined || parsedPayload.value === undefined) {
            functions.logger.warn(`Invalid 'set_schedule_part' command on topic ${topic}: missing part or value.`, { payload: messageString });
            return null;
        }
        if (!parsedPayload.targetDeviceId) {
             functions.logger.warn(`Command 'set_schedule_part' on topic ${topic} is missing targetDeviceId in payload. This is needed for user-specific logging.`, { payload: messageString });
        }
    } else if (parsedPayload.ackType === 'config_received') { 
        if (!parsedPayload.acknowledgedSchedule && !parsedPayload.acknowledgedPart) {
             functions.logger.warn(`Config ACK message on topic ${topic} missing 'acknowledgedSchedule' or 'acknowledgedPart' field.`, { payload: messageString });
        }
        if (!parsedPayload.deviceId && !parsedPayload.targetDeviceId) { // Check both as device might send deviceId, or echo targetDeviceId
            functions.logger.warn(`Config ACK message on topic ${topic} is missing 'deviceId' or 'targetDeviceId'. This is needed for user-specific logging.`, { payload: messageString });
            return null; 
        }
    } else { 
        if (!parsedPayload.deviceId && !parsedPayload.targetDeviceId) { // For general telemetry, deviceId is preferred.
             functions.logger.warn(`General message on topic ${topic}: missing deviceId or targetDeviceId. This is needed for user-specific logging.`, { payload: messageString });
        }
        if (!parsedPayload.timestamp) {
            functions.logger.info(`Message on topic ${topic} is missing timestamp. Will use server time.`, { payload: messageString });
        }
    }
    
    return parsedPayload;
  } catch (error: any) {
    functions.logger.warn(`Payload on topic ${topic} is not valid JSON or processing error: "${payloadBuffer.toString()}". Assuming plain text or unstructured. Error: ${error.message}`, { rawPayload: payloadBuffer.toString() });
    
    // For plain text on schedule topics, we cannot easily determine targetDeviceId without more context or conventions.
    // These plain text messages are logged client-side by ScheduleManager.
    // If they need to be logged to RTDB by this function, they would need to be wrapped in JSON with targetDeviceId
    // by another function/service or the ESP32 would need to respond with JSON.
    if (topic.startsWith("iot/schedule/")) { 
        const plainTextValue = payloadBuffer.toString();
        functions.logger.info(`Received plain text on ${topic}: ${plainTextValue}. This will not be logged to a user-specific RTDB path by this function due to missing targetDeviceId in plain text format.`);
        return null; 
    }
    return null; // Ignore non-JSON messages for topics not expected to be plain text
  }
}

function formatMessageForRtdb(
  topic: string,
  parsedPayload: MqttMessagePayload,
  packet: IPublishPacket
): RealtimeDatabaseMessageEntry {

  // Prioritize targetDeviceId if present (as it's likely set by web app for user context), then deviceId from payload.
  const accountIdRaw = parsedPayload.targetDeviceId || parsedPayload.deviceId || "unknown_device";
  const accountIdSanitized = sanitizeFirebaseKey(accountIdRaw);

  const entry: RealtimeDatabaseMessageEntry = {
    ...parsedPayload,
    topic: topic,
    receivedAt: Date.now(),
    qos: packet.qos as 0 | 1 | 2,
    retained: packet.retain,
    // Store the sanitized accountId as deviceId in RTDB for consistency if 'deviceId' was originally from the path.
    // If parsedPayload.targetDeviceId was used, this ensures the RTDB entry's 'deviceId' field reflects that.
    deviceId: accountIdSanitized 
  };
  
  if (entry.timestamp === undefined) {
    entry.timestamp = entry.receivedAt;
  }

  if (parsedPayload.ackType === 'config_received' && (parsedPayload.acknowledgedSchedule || parsedPayload.acknowledgedPart)) {
    entry.isAcknowledgement = true;
  }

  if (parsedPayload.command === "set_schedule_part" && parsedPayload.part && parsedPayload.value !== undefined) {
    entry.isScheduleComponentUpdate = true;
  }
  
  return entry;
}


async function getMqttClient(): Promise<MqttClient> {
  if (client && isConnected) {
    return client;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  const options: IClientOptions = {
    clientId: mqttConfig.clientId,
    username: mqttConfig.username,
    password: mqttConfig.password,
    reconnectPeriod: 5000, 
    connectTimeout: 10000,
    keepalive: 60, 
    clean: true,
    protocolVersion: 4,
  };

  functions.logger.info(`Attempting to connect to MQTT broker: ${mqttConfig.url}`);
  const newClient = mqtt.connect(mqttConfig.url, options);

  connectionPromise = new Promise<MqttClient>((resolve, reject) => {
    newClient.on("connect", () => {
      functions.logger.info("Successfully connected to MQTT broker.", { clientId: mqttConfig.clientId });
      isConnected = true;
      isConnecting = false;
      client = newClient;
      resolve(newClient);
    });

    newClient.on("error", (error: Error) => {
      functions.logger.error("MQTT client error:", { error: error.message, stack: error.stack });
      isConnected = false;
      isConnecting = false;
      if (!client || client === newClient) { 
        reject(error); 
        client = null; 
        connectionPromise = null;
      }
    });

    newClient.on("reconnect", () => {
      functions.logger.info("MQTT client attempting to reconnect...");
      isConnected = false;
      isConnecting = true;
    });

    newClient.on("offline", () => {
      functions.logger.warn("MQTT client is offline.");
      isConnected = false;
      isConnecting = false;
    });

    newClient.on("close", () => {
      functions.logger.info("MQTT client connection closed.");
      isConnected = false;
      isConnecting = false;
      if (client === newClient) { 
        client = null;
        connectionPromise = null;
      }
    });

    newClient.on("message", async (topic: string, payloadBuffer: Buffer, packet: IPublishPacket) => {
      functions.logger.info(`Received MQTT message on topic: ${topic}`, { qos: packet.qos, retained: packet.retain, length: payloadBuffer.length });
      const parsedPayload = validateAndParseMessage(topic, payloadBuffer);

      if (parsedPayload) {
        const rtdbEntry = formatMessageForRtdb(topic, parsedPayload, packet);
        // The rtdbEntry.deviceId is already the sanitized accountId from formatMessageForRtdb
        const accountIdForPath = rtdbEntry.deviceId; 
        
        const topicPathSafe = topic.replace(/[.#$[\]/]/g, "_");
        const entryTimestamp = typeof rtdbEntry.timestamp === 'number' ? rtdbEntry.timestamp : Date.now();
        const dbPath = `/user_mqtt_logs/${accountIdForPath}/${topicPathSafe}/${entryTimestamp}`;

        try {
          await admin.database().ref(dbPath).set(rtdbEntry);
          functions.logger.log(`Message from topic ${topic} (for account: ${accountIdForPath}) stored in RTDB at ${dbPath}`);
        } catch (dbError: any) {
          functions.logger.error(`Failed to write MQTT message from topic ${topic} (for account: ${accountIdForPath}) to RTDB:`, {
            error: dbError.message,
            rtdbPath: dbPath,
          });
        }
      }
    });
  });

  return connectionPromise;
}

export async function setupSubscriptions(): Promise<ISubscriptionGrant[]> {
  const currentClient = await getMqttClient();
  if (!isConnected || !currentClient) {
    functions.logger.error("MQTT client not connected. Cannot setup subscriptions.");
    throw new Error("MQTT client not connected.");
  }

  const topicsToSubscribe = mqttConfig.subscribe_topics;
  const qosLevel = mqttConfig.default_qos;

  if (topicsToSubscribe.length === 0) {
    functions.logger.warn("No topics configured for subscription.");
    return [];
  }

  functions.logger.info(`Subscribing to topics: ${topicsToSubscribe.join(", ")} with QoS ${qosLevel}`);

  return new Promise((resolve, reject) => {
    currentClient.subscribe(topicsToSubscribe, { qos: qosLevel }, (err, granted) => {
      if (err) {
        functions.logger.error("MQTT subscription error:", { error: err.message });
        return reject(err);
      }
      granted.forEach(grant => {
        if (grant.qos > 2) {
             functions.logger.error(`Failed to subscribe to ${grant.topic} - QoS not granted as requested or error code ${grant.qos}.`);
        } else {
            functions.logger.info(`Successfully subscribed to ${grant.topic} with QoS ${grant.qos}`);
        }
      });
      resolve(granted);
    });
  });
}

export async function publishMessage(
  topic: string,
  message: string | Buffer,
  options?: mqtt.IClientPublishOptions
): Promise<void> {
  const currentClient = await getMqttClient();
  if (!isConnected || !currentClient) {
    functions.logger.error("MQTT client not connected. Cannot publish message.");
    throw new Error("MQTT client not connected.");
  }

  const publishOptions = options || { qos: mqttConfig.default_qos, retain: false };
  functions.logger.info(`Publishing message to topic: ${topic}`, { qos: publishOptions.qos, retain: publishOptions.retain, length: typeof message === 'string' ? message.length : message.byteLength });

  return new Promise((resolve, reject) => {
    currentClient.publish(topic, message, publishOptions, (error?: Error) => {
      if (error) {
        functions.logger.error(`Failed to publish MQTT message to topic ${topic}:`, { error: error.message });
        return reject(error);
      }
      functions.logger.log(`Message successfully published to topic ${topic}.`);
      resolve();
    });
  });
}

export function getMqttConnectionStatus(): { isConnected: boolean, isConnecting: boolean, clientId: string | null } {
    return {
        isConnected: isConnected,
        isConnecting: isConnecting,
        clientId: client ? mqttConfig.clientId.split('-')[0] : null, // Assuming clientId might have a random suffix
    };
}

