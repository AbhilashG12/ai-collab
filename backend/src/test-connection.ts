
async function testNetwork() {
  console.log("Attempting to connect to the Groq API endpoint...");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models");
    console.log("✅ SUCCESS! A connection was established.");
    console.log("Status code:", response.status);
    if (response.status === 401) {
        console.log("Receiving a 401 'Unauthorized' status is normal and proves the connection works.");
    }
  } catch (error) {
    console.error("❌ FAILED! The connection was blocked.");
    console.error("This almost certainly means a firewall, VPN, proxy, or antivirus issue is preventing Node.js from accessing the internet.");
    console.error("The specific error was:", error);
  }
}

testNetwork();