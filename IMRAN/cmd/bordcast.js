const fs = require('fs');
const request = require('request');

module.exports.config = {
  name: "notic",
  version: "1.0.0",
  permission: 2,
  credits: "Modified by IMRAN ",
  description: "Send notice to all groups only",
  prefix: true,
  premium: false,
  category: "admin",
  usages: "[message]",
  cooldowns: 5,
};

let atmDir = [];

const getAtm = (atm, body) => new Promise(async (resolve) => {
  let msg = {}, attachment = [];
  msg.body = body;
  for (let eachAtm of atm) {
    await new Promise((resolve) => {
      try {
        const pathName = eachAtm.url.substring(eachAtm.url.lastIndexOf("/") + 1);
        const ext = pathName.substring(pathName.lastIndexOf(".") + 1);
        const filePath = __dirname + `/cache/${eachAtm.filename}.${ext}`;
        request.get(eachAtm.url)
          .pipe(fs.createWriteStream(filePath))
          .on("close", () => {
            attachment.push(fs.createReadStream(filePath));
            atmDir.push(filePath);
            resolve();
          });
      } catch (e) {
        console.log(e);
        resolve();
      }
    });
  }
  msg.attachment = attachment;
  resolve(msg);
});

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, body } = event;

  switch (handleReply.type) {
    case "sendnoti": {
      let text = `${body}`;
      if (event.attachments.length > 0) {
        text = await getAtm(event.attachments, text);
      }

      api.sendMessage(text, handleReply.threadID, (err, info) => {
        atmDir.forEach(each => fs.unlinkSync(each));
        atmDir = [];
        global.client.handleReply.get(api.getCurrentUserID()).push({
          name: this.config.name,
          type: "reply",
          messageID: info.messageID,
          messID: messageID,
          threadID
        });
      });
      break;
    }

    case "reply": {
      let text = `${body}`;
      if (event.attachments.length > 0) {
        text = await getAtm(event.attachments, text);
      }

      api.sendMessage(text, handleReply.threadID, (err, info) => {
        atmDir.forEach(each => fs.unlinkSync(each));
        atmDir = [];
        global.client.handleReply.get(api.getCurrentUserID()).push({
          name: this.config.name,
          type: "sendnoti",
          messageID: info.messageID,
          threadID: handleReply.threadID
        });
      }, handleReply.messID);
      break;
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, messageReply } = event;

  // ✅ Check for bot admin permission
  if (!global.config.ADMINBOT || !global.config.ADMINBOT.includes(senderID)) {
    return api.sendMessage("❌ You don't have permission to use this command.", threadID, messageID);
  }

  if (!args[0]) return api.sendMessage("❌ Please provide a message to send.", threadID);

  let text = args.join(" ");
  const botID = api.getCurrentUserID();
  if (!global.client.handleReply.has(botID)) global.client.handleReply.set(botID, []);

  if (event.type === "message_reply" && messageReply.attachments.length > 0) {
    text = await getAtm(messageReply.attachments, text);
  }

  let success = 0, fail = 0;

  for (const id of global.data.allThreadID || []) {
    try {
      api.sendMessage(text, id, (err, info) => {
        if (err) return fail++;
        success++;
        global.client.handleReply.get(botID).push({
          name: this.config.name,
          type: "sendnoti",
          messageID: info.messageID,
          messID: messageID,
          threadID: id
        });
      });
    } catch (err) {
      fail++;
    }
  }

  return api.sendMessage(`✅ Sent to ${success} groups\n❌ Failed to send to ${fail}`, threadID);
};