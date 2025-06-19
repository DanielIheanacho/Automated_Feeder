
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import { getMqttConfig } from "./config";
import {
  setupSubscriptions,
  publishMessage,
  getMqttConnectionStatus,
} from "./mqttClient";
import type { MqttCommandToPublish, HttpPublishRequestBody } from "./interfaces";

/**
 * @fileoverview Firebase Cloud Functions for MQTT integration.
 * Includes functions for subscribing to MQTT topics, publishing messages,
 * and monitoring connection status.
 */

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const corsHandler = cors({ origin: true });
const mqttConfig = getMqttConfig();

export const subscribeToMqtt = functions
  .region("us-east1")
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        functions.logger.warn("subscribeToMqtt: Method Not Allowed.", { method: req.method });
        res.status(405).send("Method Not Allowed. Please use POST.");
        return;
      }
      try {
        await setupSubscriptions(); 
        functions.logger.info("MQTT subscription setup process initiated successfully.");
        res.status(200).send("MQTT subscription setup process initiated successfully.");
      } catch (error: any) {
        functions.logger.error("Failed to setup MQTT subscriptions:", {
          errorMessage: error.message,
          stack: error.stack,
        });
        res.status(500).send(`Failed to setup MQTT subscriptions: ${error.message}`);
      }
    });
  });

/**
 * HTTP-triggered function to publish a message to an MQTT topic.
 * This function is intended to be called by your web application frontend.
 * Expects a JSON payload in the request body conforming to `HttpPublishRequestBody`.
 *
 * @example Request Body for a schedule component update (JSON):
 * {
 *  "topic": "iot/schedule/time", // Generic topic
 *  "payload": {
 *    "command": "set_schedule_part",
 *    "part": "time",
 *    "value": "09:30",
 *    "targetDeviceId": "feeder01" // Device ID is now in the payload
 *  },
 *  "qos": 1,
 *  "retain": true
 * }
 */
export const publishToMqttViaHttp = functions
  .region("us-east1")
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        functions.logger.warn("publishToMqttViaHttp: Method Not Allowed.", { method: req.method });
        res.status(405).send("Method Not Allowed. Please use POST.");
        return;
      }

      try {
        const { topic, payload, qos, retain } = req.body as HttpPublishRequestBody;

        if (!topic || payload === undefined) {
          functions.logger.warn("publishToMqttViaHttp: Missing 'topic' or 'payload'.", { body: req.body });
          res.status(400).send("Missing 'topic' or 'payload' in request body.");
          return;
        }

        if (typeof payload !== "object" || payload === null) {
          functions.logger.warn("publishToMqttViaHttp: Invalid 'payload' format.", { payload });
          res.status(400).send("'payload' must be a non-null object.");
          return;
        }
        // If the topic is generic (e.g., iot/schedule/time), targetDeviceId should be in payload.
        if (topic.startsWith("iot/schedule/") && !payload.targetDeviceId) {
            functions.logger.warn(`Payload for generic topic ${topic} is missing 'targetDeviceId'. This might be acceptable if the message is for all devices or context is implicit.`, { payload });
        }

        const message = JSON.stringify(payload);

        await publishMessage(topic, message, {
          qos: (qos ?? mqttConfig.default_qos) as 0 | 1 | 2,
          retain: retain ?? false, 
        });

        functions.logger.info(`Message published to MQTT topic ${topic} via HTTP.`, { topic, payload });
        res.status(200).send({ message: `Message successfully published to MQTT topic ${topic}.` });
      } catch (error: any) {
        functions.logger.error("Failed to publish MQTT message via HTTP:", {
          errorMessage: error.message,
          stack: error.stack,
          requestBody: req.body,
        });
        res.status(500).send(`Failed to publish MQTT message: ${error.message}`);
      }
    });
  });

export const publishToMqttOnDbWrite = functions
  .region("us-east1")
  .database.ref("/commands/{deviceId}/{pushId}")
  .onCreate(async (snapshot, context) => {
    const deviceId = context.params.deviceId; // This deviceId comes from the DB path
    const commandData = snapshot.val() as MqttCommandToPublish;

    if (!commandData || 
        (!commandData.command && !commandData.schedule && !(commandData.part && commandData.value !== undefined) )) {
      functions.logger.warn(
        `DB trigger: No valid command/schedule/part data for device ${deviceId} at ${snapshot.ref.path}. Ignoring.`, { data: commandData }
      );
      return null;
    }

    // Default topic will include the deviceId from the DB path.
    // If commandData.topic is provided AND it's a generic topic (e.g. "iot/schedule/time"),
    // then commandData.targetDeviceId must also be set to this deviceId.
    let topicToPublish = commandData.topic || `${mqttConfig.default_publish_topic}/${deviceId}`;
    
    const payloadToPublish: MqttCommandToPublish = { ...commandData };

    // Ensure targetDeviceId is set correctly, especially if a generic topic is specified in commandData.topic
    if (!payloadToPublish.targetDeviceId) {
        payloadToPublish.targetDeviceId = deviceId; // Set targetDeviceId from the DB path
    } else if (payloadToPublish.targetDeviceId !== deviceId && commandData.topic && !commandData.topic.includes(deviceId)) {
        // Warning if commandData.topic is generic but targetDeviceId in payload mismatches deviceId from DB path
        functions.logger.warn(
            `DB trigger: Mismatch or ambiguity. DB path deviceId is ${deviceId}, but payload's targetDeviceId is ${payloadToPublish.targetDeviceId} for a potentially generic topic ${commandData.topic}. Using payload's targetDeviceId.`,
            { data: commandData }
        );
    }
    // If the topic in commandData doesn't already include a deviceId placeholder, and we're using default_publish_topic structure.
    if (commandData.topic && !commandData.topic.includes(deviceId) && !commandData.topic.startsWith("iot/schedule/")) {
        // This case is tricky. If commandData.topic is a fully specific topic not matching default structure, use it as is.
        // If it's a generic command topic, it might need deviceId appended or deviceId should be in payload.
        // For now, if commandData.topic is set, we use it directly.
        topicToPublish = commandData.topic;
    }


    functions.logger.info(
      `DB trigger: Received data for device ${deviceId}:`,
      { data: commandData, targetTopic: topicToPublish, payloadToPublish }
    );

    try {
      await publishMessage(topicToPublish, JSON.stringify(payloadToPublish), {
        qos: (commandData.qos ?? mqttConfig.default_qos) as 0 | 1 | 2,
        retain: commandData.retain ?? false,
      });
      functions.logger.log(
        `DB trigger: Data for ${deviceId} (target: ${payloadToPublish.targetDeviceId}) successfully published to MQTT topic ${topicToPublish}.`
      );
      return null;
    } catch (error: any) {
      functions.logger.error(
        `DB trigger: Failed to publish data for ${deviceId} to MQTT topic ${topicToPublish}:`,
        { errorMessage: error.message, stack: error.stack }
      );
      return null;
    }
  });

export const getMqttStatus = functions
  .region("us-east1")
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        functions.logger.warn("getMqttStatus: Method Not Allowed.", { method: req.method });
        res.status(405).send("Method Not Allowed. Please use GET.");
        return;
      }
      try {
        const status = getMqttConnectionStatus();
        functions.logger.info("Reporting MQTT connection status.", status);
        res.status(200).json(status);
      } catch (error: any) {
        functions.logger.error("Failed to get MQTT status:", {
          errorMessage: error.message,
          stack: error.stack,
        });
        res.status(500).send(`Failed to retrieve MQTT status: ${error.message}`);
      }
    });
  });

