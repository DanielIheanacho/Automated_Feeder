
/**
 * @fileoverview TypeScript interfaces for MQTT messages and related data structures.
 */

/**
 * Represents the structure of an incoming MQTT message payload after parsing.
 * This is a generic example; you should adapt it to your specific message format.
 * For acknowledgements, the ESP32 should send a payload that includes original schedule details.
 */
export interface MqttMessagePayload {
  deviceId?: string; // Device ID from the device itself (e.g., in telemetry or ACKs)
  targetDeviceId?: string; // Device ID specified in commands, esp. for generic topics
  timestamp?: number; // Unix timestamp of when the event occurred on the device
  
  // Common telemetry data
  temperature?: number;
  humidity?: number;
  status?: string; // e.g., "online", "feeding_started", "feeding_complete"
  
  // For config acknowledgements sent by device
  acknowledgedSchedule?: {
    time: string;
    frequency: string;
    amount: string;
    enabled: boolean;
  };
  ackType?: 'config_received'; // To differentiate acknowledgement messages

  // For schedule part updates received by device (device might echo this back in an ACK)
  acknowledgedPart?: {
    part: 'time' | 'frequency' | 'amount' | 'enabled';
    value: string | boolean | number;
  };
  
  // If the incoming message is a schedule part itself
  part?: 'time' | 'frequency' | 'amount' | 'enabled';
  value?: string | boolean | number | object;
  command?: string; // e.g., "set_schedule_part"

  [key: string]: any; // Allow other dynamic properties
}

/**
 * Represents the structure for data written to Firebase Realtime Database
 * for incoming MQTT messages.
 */
export interface RealtimeDatabaseMessageEntry extends MqttMessagePayload {
  receivedAt: number; // Unix timestamp when the message was processed by the function
  topic: string;
  qos: 0 | 1 | 2;
  retained: boolean;
  isAcknowledgement?: boolean;
  isScheduleComponentUpdate?: boolean; // Flag to identify schedule component messages
}

/**
 * Represents the structure of a command/data to be published via MQTT,
 * often originating from an HTTP request or a Realtime Database trigger.
 */
export interface MqttCommandToPublish {
  command?: string; // e.g., "set_schedule", "dispense_food", "set_schedule_part"
  
  // For publishing individual schedule parts
  part?: 'time' | 'frequency' | 'amount' | 'enabled';
  value?: string | number | boolean | object; // The actual value of the part or general command value

  // For publishing a full schedule (optional, if still used for some commands)
  schedule?: {
    time: string;
    frequency: string; 
    amount: string;
    enabled: boolean;
  };

  publishedAt?: string; // ISO string timestamp from web app
  source?: string; // e.g., "AquaFeedWebApp"
  
  // Target device ID, crucial if publishing to a generic topic that doesn't include device ID.
  // For DB triggers, this would typically be the deviceId from the path.
  // For HTTP triggers, the client should send this in the payload.
  targetDeviceId?: string; 
  
  topic?: string; // Optional: if publishing from DB write and want to override default topic
  qos?: 0 | 1 | 2; // Optional: QoS for DB trigger
  retain?: boolean; // Optional: Retain flag for DB trigger
  
  [key: string]: any; // Allow other dynamic properties
}


/**
 * Interface for the request body of the `publishToMqttViaHttp` function.
 */
export interface HttpPublishRequestBody {
  topic: string; // Can be a generic topic like "iot/schedule/time"
  payload: MqttCommandToPublish; // The actual data/command structure to send
  qos?: 0 | 1 | 2;
  retain?: boolean;
}
