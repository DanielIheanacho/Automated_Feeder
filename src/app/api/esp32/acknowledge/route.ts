
// This file is no longer used for MQTT-based acknowledgements.
// With MQTT, the ESP32 publishes an acknowledgement message to an MQTT topic.
// The `subscribeToMqtt` Firebase Cloud Function subscribes to that topic.
// When a message arrives, the Cloud Function's MQTT client handler
// processes it and writes the relevant log data to Firebase Realtime Database.
// The LogViewer component then listens to RTDB for these updates.

// This HTTP endpoint is therefore redundant in an MQTT-centric acknowledgement flow.
// Its content is cleared. If you need a direct HTTP endpoint for other ESP32 interactions,
// you can rebuild it for that specific purpose.

export async function POST(request: Request) {
  // Deprecated in favor of MQTT flow
  return new Response(JSON.stringify({ message: "This endpoint is deprecated for MQTT acknowledgements." }), {
    status: 410, // Gone
    headers: { "Content-Type": "application/json" },
  });
}
