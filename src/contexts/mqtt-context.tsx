
"use client";

import type { MqttClient, IClientOptions, IClientPublishOptions } from 'mqtt';
import mqtt from 'mqtt';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MqttContextType {
  client: MqttClient | null;
  isConnected: boolean;
  error: string | null;
  publish: (topic: string, message: string | Buffer, options?: IClientPublishOptions) => Promise<boolean>;
}

const MqttContext = createContext<MqttContextType | undefined>(undefined);

const MQTT_BROKER_URL = "wss://e87d0416.ala.us-east-1.emqxsl.com:8084/mqtt";
const MQTT_USERNAME = "Website";
const MQTT_PASSWORD = "2025";
const MQTT_CLIENT_ID = "aquafeed-webapp-static";

export const MqttProvider = ({ children }: { children: ReactNode }) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log("MqttProvider: useEffect triggered. Attempting to initialize and connect to broker.");

    const options: IClientOptions = {
      clientId: `${MQTT_CLIENT_ID}-${Math.random().toString(16).substring(2, 10)}`, // Ensure unique client ID
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      reconnectPeriod: 4000, // Reconnect after 4 seconds
      connectTimeout: 10000, // 10 seconds
      keepalive: 120, // Keep MQTT alive for 120 seconds
      reschedulePings: true,
      protocolVersion: 4,
      clean: true,
    };

    console.log("MqttProvider: Connecting with URL:", MQTT_BROKER_URL);
    console.log("MqttProvider: Connection options:", JSON.stringify(options, (key, value) => key === 'password' ? '***' : value, 2));


    const mqttClientInstance = mqtt.connect(MQTT_BROKER_URL, options);
    setClient(mqttClientInstance);

    mqttClientInstance.on('connect', (connack) => {
      console.log('MqttProvider: Connected to broker! connack:', connack);
      setIsConnected(true);
      setError(null);
      toast({ title: "MQTT Connected", description: "Successfully connected to the MQTT broker.", variant: "default", duration: 3000 });
    });

    mqttClientInstance.on('reconnect', () => {
      console.log('MqttProvider: Reconnecting to broker...');
      setIsConnected(false);
      setError("Reconnecting...");
    });

    mqttClientInstance.on('close', () => {
      console.warn('MqttProvider: Connection closed.');
      setIsConnected(false);
      setError("Connection closed.");
    });

    mqttClientInstance.on('offline', () => {
      console.warn('MqttProvider: Client is offline.');
      setIsConnected(false);
      setError("MQTT client is offline.");
      toast({ title: "MQTT Offline", description: "MQTT client went offline.", variant: "destructive", duration: 3000 });
    });

    mqttClientInstance.on('error', (err) => {
      console.error('MqttProvider: Connection error:', err.message, err);
      setIsConnected(false);
      setError(err.message);
      if (!mqttClientInstance.reconnecting) {
         toast({ title: "MQTT Error", description: `Connection error: ${err.message}`, variant: "destructive", duration: 5000 });
      }
    });

    mqttClientInstance.on('message', (topic, payloadBuffer) => {
      const payload = payloadBuffer.toString();
      console.log(`MqttProvider: Received message on topic ${topic}: ${payload}`);
      // Example: Display a toast for certain incoming messages if desired
      // if (topic === "iot/status/feeder01") {
      //   toast({ title: "Device Status Update", description: `Feeder01: ${payload}`, duration: 3000});
      // }
    });

    return () => {
      if (mqttClientInstance) {
        console.log('MqttProvider: Cleaning up - disconnecting MQTT client...');
        mqttClientInstance.end(true, () => {
            console.log('MqttProvider: MQTT client forcibly disconnected.');
            setIsConnected(false);
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array ensures this runs once on mount and unmount

  const publish = useCallback(async (topic: string, message: string | Buffer, options?: IClientPublishOptions): Promise<boolean> => {
    if (!client || !isConnected) {
      console.error('MqttProvider: Client not connected or not ready. Cannot publish.');
      toast({ title: "MQTT Publish Error", description: "Client not connected. Cannot publish.", variant: "destructive" });
      setError(client ? "Client not connected" : "Client not initialized");
      return false;
    }
    console.log(`MqttProvider: Attempting to publish to ${topic}`, { payload: typeof message === 'string' ? message : `Buffer (len: ${message.length})` , options });
    try {
      await new Promise<void>((resolve, reject) => {
        client.publish(topic, message, options || { qos: 1, retain: false }, (err) => {
          if (err) {
            console.error(`MqttProvider: Failed to publish to ${topic}:`, err);
            reject(err);
          } else {
            console.log(`MqttProvider: Successfully published to ${topic}`);
            resolve();
          }
        });
      });
      return true;
    } catch (err: any) {
      console.error(`MqttProvider: Error during publish to ${topic}:`, err);
      toast({ title: "MQTT Publish Failed", description: `Failed to publish to ${topic}: ${err.message}`, variant: "destructive" });
      setError(`Publish failed: ${err.message}`);
      return false;
    }
  }, [client, isConnected, toast]);


  return (
    <MqttContext.Provider value={{ client, isConnected, error, publish }}>
      {children}
    </MqttContext.Provider>
  );
};

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (context === undefined) {
    throw new Error('useMqtt must be used within an MqttProvider');
  }
  return context;
};

