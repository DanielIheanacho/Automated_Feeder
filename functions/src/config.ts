
import * as functions from "firebase-functions";

/**
 * @fileoverview Configuration management for Firebase Functions.
 * Retrieves MQTT broker details and credentials from Firebase Function Configuration.
 */

export interface MqttConfig {
  url: string;
  username?: string;
  password?: string;
  clientId: string;
  subscribe_topics: string[]; 
  default_publish_topic: string;
  default_qos: 0 | 1 | 2;
}

/**
 * Retrieves and validates the MQTT configuration from Firebase Function environment configuration.
 * It's recommended to set these in Firebase using `firebase functions:config:set mqtt.url="..."` etc.
 *
 * Example Firebase config for EMQX Cloud:
 * firebase functions:config:set mqtt.url="mqtts://e87d0416.ala.us-east-1.emqxsl.com:8883" \
 * mqtt.username="your_mqtt_username" \
 * mqtt.password="your_mqtt_password" \
 * mqtt.client_id="firebase-functions-client" \
 * mqtt.subscribe_topics="iot/telemetry/device_xyz,iot/status/device_xyz,iot/device_xyz/config/ack" \
 * mqtt.default_publish_topic="iot/commands" \
 * mqtt.default_qos="1"
 *
 * @returns {MqttConfig} The MQTT configuration.
 * @throws {Error} If essential MQTT configuration is missing.
 */
export function getMqttConfig(): MqttConfig {
  const config = functions.config().mqtt;

  if (!config) {
    functions.logger.error(
      "MQTT configuration (functions.config().mqtt) is not set."
    );
    throw new Error(
      "MQTT configuration is missing. Set it using `firebase functions:config:set mqtt...`"
    );
  }

  if (!config.url || !config.client_id) {
    functions.logger.error(
      "Essential MQTT config (url, client_id) is missing."
    );
    throw new Error(
      "Missing essential MQTT config: url and client_id are required."
    );
  }

  const subscribeTopicsString = config.subscribe_topics || "iot/default_topic";
  const defaultQosString = config.default_qos || "1"; // Default QoS to 1 if not set

  return {
    url: config.url, // e.g., "mqtts://e87d0416.ala.us-east-1.emqxsl.com:8883"
    username: config.username,
    password: config.password,
    clientId: `${config.client_id}-${Math.random().toString(16).substring(2, 10)}`, // Append random suffix for uniqueness
    subscribe_topics: subscribeTopicsString.split(",").map((t: string) => t.trim()),
    default_publish_topic: config.default_publish_topic || "iot/commands/default",
    default_qos: parseInt(defaultQosString, 10) as 0 | 1 | 2,
  };
}
