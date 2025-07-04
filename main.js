const login = require('priyanshu-fca');
const axios = require('axios');
const { join } = require('path');
const fs = require('fs-extra');

async function startBot() {
  global.client = {
    commands: new Map(),
    handleReply: new Map(),
    events: new Map()
  };

  global.data = {
    allThreadID: [] // ✅ Used in adminnoti command
  };

  const configPath = join(__dirname, 'config.json');
  global.config = fs.existsSync(configPath) ? require(configPath) : {};

  let appState = fs.existsSync('appstate.json') ? require('./appstate.json') : null;
  if (!appState) {
    console.error("❌ appstate.json file missing");
    process.exit(1);
  }

  login({ appState }, async (err, api) => {
    if (err) {
      console.error("❌ Login failed:", err);
      process.exit(1);
    }

    global.api = api;
    console.log("✅ Yukira bot is running...");

    // ✅ Load only group thread IDs (ignore inboxes)
    try {
      const threads = await api.getThreadList(100, null, ["INBOX"]);
      const groupsOnly = threads.filter(t => t.isGroup && t.isSubscribed);
      global.data.allThreadID = groupsOnly.map(t => t.threadID);
      console.log(`✅ Loaded ${global.data.allThreadID.length} group thread IDs`);
    } catch (e) {
      console.error("❌ Failed to load group thread list:", e);
    }

    // ✅ Load commands
    const commandFolder = join(__dirname, 'IMRAN/cmd');
    fs.readdirSync(commandFolder).forEach(file => {
      if (file.endsWith('.js')) {
        try {
          const command = require(join(commandFolder, file));
          const name = command.config?.name || file.split('.js')[0];
          global.client.commands.set(name, command);
          console.log(`✅ Loaded command: ${name}`);
        } catch (err) {
          console.error(`❌ Failed to load ${file}:`, err);
        }
      }
    });


    // ✅ Listen to events
    api.listenMqtt((err, event) => {
      if (err) return console.error("❌ Listen error:", err);

      try {
        switch (event.type) {
          case "message":
          case "message_reply":
            handleMessage(api, event);
            break;

          case "message_reaction":
            handleReaction(api, event);
            break;

          case "event":
            const eventHandler = global.client.events.get(event.logMessageType);
            if (eventHandler) eventHandler.handleEvent({ api, event });
            break;
        }

        // Optional: trigger specific commands with handleEvent
        const textreply = global.client.commands.get("textReply");
        const yukiraEmoji = global.client.commands.get("emoji");
        if (textreply?.handleEvent) textreply.handleEvent({ api, event, client: global.client });
        if (yukiraEmoji?.handleEvent) yukiraEmoji.handleEvent({ api, event, client: global.client });

      } catch (error) {
        console.error("❌ Event handler error:", error);
      }
    });

    // ✅ Optional Auto Restart after 1 hour
    setTimeout(() => {
      console.log("⏰ Restarting bot after 1 hour...");
      process.exit(0);
    }, 60 * 60 * 1000);
  });

  // ✅ Reaction Handler
  async function handleReaction(api, event) {
    const { reaction, threadID } = event;
    if (reaction === "❤️") {
      api.sendMessage("Thanks for the ❤️ reaction!", threadID);
    }
  }

  // ✅ Message Handler
  async function handleMessage(api, event) {
    const args = event.body ? event.body.split(/\s+/) : [];
    const command = args.shift()?.toLowerCase();

    if (global.client.commands.has(command)) {
      await global.client.commands.get(command).run({ api, event, args });
    } else {
      const botID = api.getCurrentUserID();
      const replies = global.client.handleReply.get(botID) || [];

      const found = replies.find(r =>
        r.messageID === event.messageReply?.messageID &&
        r.author === event.senderID
      );

      if (found && global.client.commands.has(found.name)) {
        await global.client.commands.get(found.name).handleReply({ api, event });
      }
    }
  }

  // ✅ Global error logging
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

module.exports = startBot;
