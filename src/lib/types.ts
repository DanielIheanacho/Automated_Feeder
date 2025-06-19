
export type FeedingFrequency = 'Once a day' | 'Twice a day' | 'Thrice a day';

export interface ScheduleEntry {
  id: string; // User's email, making the schedule user-specific
  time: string; // e.g., "10:00" - Represents the time for the FIRST meal
  frequency: FeedingFrequency;
  amount: string; // e.g., "15g" - Represents the TOTAL DAILY food amount
  enabled: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  status:
    | 'Schedule Set'
    | 'Schedule Updated'
    | 'Schedule Cleared'
    | 'Success'
    | 'Skipped'
    | 'Error'
    | 'Device Sync: Config Sent'
    | 'Device Sync: Config Acknowledged'
    | string; // Allow for dynamic device status strings like "Device: Updated time"

  amount?: string;

  scheduleDetails?: {
    time: string; // First meal time
    frequency: FeedingFrequency;
    amount: string; // Total daily amount
    enabled: boolean;
  };
  deviceId?: string;
  notes?: string; // For additional context, e.g., detailed schedule string or target topic
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
