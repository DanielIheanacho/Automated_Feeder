
export type FeedingFrequency = 'Once a day' | 'Twice a day' | 'Thrice a day';

export interface ScheduleEntry {
  id: string; // Can be a fixed ID like "current-active-schedule"
  time: string; // e.g., "10:00"
  frequency: FeedingFrequency;
  amount: string; // e.g., "5g" (system implies grams, user enters number)
  enabled: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  status:
    | 'Schedule Set'      // A new schedule was configured
    | 'Schedule Updated'  // An existing schedule was modified (content or enabled state)
    | 'Schedule Cleared'  // The active schedule was cleared
    | 'Success'           // Feeding event from ESP32: Successful feeding
    | 'Skipped'           // Feeding event from ESP32: Scheduled feeding was skipped
    | 'Error'             // Feeding event from ESP32: Feeding failed
    | 'Device Sync: Config Sent'       // App attempted to send schedule to device
    | 'Device Sync: Config Acknowledged'; // Device confirmed receipt of schedule

  // Fields for feeding events
  amount?: string; // e.g., "5g", amount fed or attempted

  // Fields for schedule configuration changes or device sync
  // For 'Schedule Set', 'Schedule Updated', 'Schedule Cleared': details of the schedule.
  // For 'Device Sync: Config Sent': details of the schedule sent.
  // For 'Device Sync: Config Acknowledged': details of the schedule acknowledged by device.
  scheduleDetails?: {
    time: string;
    frequency: FeedingFrequency;
    amount: string;
    enabled: boolean; // Relevant for all schedule-related logs
  };
  deviceId?: string; // Optional: an identifier for the ESP32 or device
  notes?: string; // Optional field for additional context, e.g., target topic
}

export type SystemStatus = 'Idle' | 'Feeding' | 'Dispensing' | 'Error' | 'Connecting' | 'Offline';

export type AiAdvisorState = {
  isLoading: boolean;
  advice: string | null;
  error: string | null;
};

export interface User {
  email: string;
}
