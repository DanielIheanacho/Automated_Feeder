
"use server";

import type { LogEntry, ScheduleEntry } from '@/lib/types';

export async function getAIMessage(prompt: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  if (prompt.toLowerCase().includes("error simulation")) {
    throw new Error("Simulated AI error.");
  }
  const responses = [
    `Considering "${prompt}", it seems like a reasonable time to feed. However, always observe your fish's behavior.`,
    `Based on "${prompt}", if they haven't been fed recently, now could be a good time. Check their activity levels.`,
    `Regarding "${prompt}", ensure the water parameters are stable before feeding. If all good, proceed.`,
    `Hmm, "${prompt}"... It's generally better to underfeed slightly than overfeed. If in doubt, a small portion is okay.`,
    `For "${prompt}", if it's their usual feeding time and they appear active, then yes, feeding is advisable.`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export interface FeedingEventData {
  status: 'Success' | 'Error' | 'Skipped';
  amountFed: string;
}

export interface RecordFeedingEventResponse {
  success: boolean;
  message: string;
  logId?: string;
  timestamp?: string;
}

export async function recordFeedingEvent(
  eventData: FeedingEventData
): Promise<RecordFeedingEventResponse> {
  console.log("Server Action: recordFeedingEvent received data:", eventData);
  await new Promise(resolve => setTimeout(resolve, 500));
  const serverTimestamp = new Date();
  const newLogId = crypto.randomUUID();
  
  const logEntryForDb: Pick<LogEntry, 'id' | 'timestamp' | 'status' | 'amount'> = {
    id: newLogId,
    timestamp: serverTimestamp,
    status: eventData.status,
    amount: eventData.amountFed,
  };

  if (Math.random() < 0.05) {
    console.error("Server Action: Failed to record feeding event (simulated error)", eventData);
    return {
      success: false,
      message: "Simulated backend error: Could not record feeding event.",
    };
  }
  console.log("Server Action: Feeding event processed and 'saved' (simulated):", logEntryForDb);
  return {
    success: true,
    message: "Feeding event successfully processed by the server (simulated).",
    logId: newLogId,
    timestamp: serverTimestamp.toISOString(),
  };
}

/**
 * This server action is effectively replaced by client-side logic in ScheduleManager
 * that directly calls the `publishToMqttViaHttp` Cloud Function.
 * Kept for reference or if a server-to-server intermediary is desired later.
 */
export async function sendConfigurationToDevice(
  // schedule: ScheduleEntry
): Promise<{ success: boolean; message: string; logEntryData?: Omit<LogEntry, 'id' | 'timestamp'> }> {
  console.log("Server Action: sendConfigurationToDevice - This action is conceptually replaced by direct client call to Cloud Function.");
  
  // This function would previously have initiated the MQTT publish or HTTP call.
  // Now, ScheduleManager directly calls the publishToMqttViaHttp Cloud Function.

  // If this server action were to be used as an intermediary:
  // 1. It would receive the schedule.
  // 2. It would make an HTTP request to the `publishToMqttViaHttp` Cloud Function.
  // 3. Based on the CF response, it would return success/failure and log data.

  // For now, returning a placeholder response.
  return {
    success: false,
    message: "This server action (sendConfigurationToDevice) is not actively used for MQTT publishing in the current flow. Client calls Cloud Function directly.",
  };
}

/**
 * This server action is conceptually replaced by the Cloud Function's MQTT subscriber
 * which processes acknowledgement messages from the device and writes to Realtime Database.
 * Kept for reference.
 */
export async function recordDeviceAcknowledgement(
  // acknowledgedSchedule: ScheduleEntry,
  // deviceId?: string
): Promise<{ success: boolean; message: string; logEntryData?: Omit<LogEntry, 'id' | 'timestamp'> }> {
  console.log("Server Action: recordDeviceAcknowledgement - This action is conceptually replaced by Cloud Function MQTT listener writing to RTDB.");

  // This function would previously have been called by an API route hit by the ESP32.
  // In an MQTT flow, the Cloud Function listening to MQTT ack topics handles this.
  
  // If this action were still used (e.g., by a Cloud Function):
  // 1. It would receive the acknowledged schedule.
  // 2. It would prepare the log entry data.
  // 3. It might perform other server-side tasks.

  // For now, returning a placeholder response.
  return {
    success: false,
    message: "This server action (recordDeviceAcknowledgement) is not actively used for MQTT acks in the current flow. Cloud Function handles MQTT acks.",
  };
}
