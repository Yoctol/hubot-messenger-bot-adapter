const Adapter = require('hubot').Adapter;
const TextMessage = require('hubot').TextMessage;
const get = require('lodash/get');
const chalk = require('chalk');
const debug = require('debug')('hubot-messenger-bot-adapter');

const createUser = (userId, roomId, cb) => {
  const user = {
    id: userId,
    name: '',
    room: roomId,
  };
  return cb(user);
};

class Messenger extends Adapter {
  constructor(robot) {
    super();
    this.robot = robot;
    this.verifyToken = process.env.MESSENGER_VERIFY_TOKEN;
    this.apiURL = 'https://graph.facebook.com/v2.6';
    this.robot.logger.info('hubot-messenger-bot: Adapter loaded.');
  }

  processTextMsg(msg, text) {
    const _sender = msg.sender.id;
    const _recipient = msg.recipient.id;
    const _mid = msg.message.mid;
    const _text = text;

    createUser(_sender, _recipient, user => {
      const message = new TextMessage(user, _text.trim(), _mid);
      message.room = _recipient;
      return this.receive(message);
    });
  }

  processAttachmentMsg(msg, attachmentType) {
    const _sender = msg.sender.id;
    const _recipient = msg.recipient.id;
    const _mid = msg.message.mid;
    const _text = `${attachmentType}`;

    createUser(_sender, _recipient, user => {
      const message = new TextMessage(user, _text.trim(), _mid);
      message.room = _recipient;
      return this.receive(message);
    });
  }

  processPayload(msg, payload) {
    const _sender = msg.sender.id;
    const _recipient = msg.recipient.id;
    const _text = payload;

    createUser(_sender, _recipient, user => {
      const message = new TextMessage(user, _text.trim());
      message.room = _recipient;
      return this.receive(message);
    });
  }
  /* eslint-disable class-methods-use-this */
  processDelivery() {
    // no handle
    debug(chalk.magenta('processDelivery not handle now'));
    return;
  }

  processRead() {
    // no handle
    debug(chalk.magenta('processRead not handle now'));
    return;
  }

  processEchoTextMsg() {
    // FIXME
    return;
  }

  processEchoAttachmentMsg() {
    // FIXME
    return;
  }
  /* eslint-enable class-methods-use-this */

  processEcho(msg) {
    const text = get(msg, 'message.text');
    const attachmentType = get(msg, 'message.attachments[0].type'); // image, audio, video, file or location
    if (text) {
      return this.processEchoTextMsg();
    } else if (attachmentType) {
      return this.processEchoAttachmentMsg();
    }
    return;
  }

  processMsg(msg) {
    debug(chalk.red(new Date().toISOString()));
    debug(chalk.green('trying to process msg..'));
    debug(chalk.green(JSON.stringify(msg, null, 2)));

    const isEcho = get(msg, 'message.is_echo');
    const delivery = get(msg, 'delivery');
    const read = get(msg, 'read');
    const quickReplyPayload = get(msg, 'message.quick_reply.payload'); // DEVELOPER_DEFINED_PAYLOAD
    const postbackPayload = get(msg, 'postback.payload'); // DEVELOPER_DEFINED_PAYLOAD
    const text = get(msg, 'message.text');
    const attachmentType = get(msg, 'message.attachments[0].type'); // image, audio, video, file or location

    if (isEcho) {
      return this.processEcho(msg);
    } else if (delivery) {
      return this.processDelivery();
    } else if (read) {
      return this.processRead();
    } else if (quickReplyPayload) {
      return this.processPayload(msg, quickReplyPayload);
    } else if (postbackPayload) {
      return this.processPayload(msg, postbackPayload);
    } else if (text) {
      return this.processTextMsg(msg, text);
    } else if (attachmentType) {
      return this.processAttachmentMsg(msg, attachmentType);
    }
    return;
  }

  postData(data, accessToken) {
    this.robot.http(`${this.apiURL}/me/messages?access_token=${accessToken}`)
      .header('Content-Type', 'application/json').post(data)((err, httpRes, body) => {
        if (err || httpRes.statusCode !== 200) {
          return this.robot.logger.error(`hubot-messenger-bot: error sending message - ${body} ${httpRes.statusCode} (${err})`);
        }
        return this.robot.logger.info('hubot-messenger-bot: post successed!');
      });
  }

  sendButtonMsg(context, text, buttons, accessToken) {
    const data = JSON.stringify({
      recipient: {
        id: context.user.id,
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: text.substring(0, 320),
            buttons,
          },
        },
      },
    });

    this.postData(data, accessToken);
  }

  sendTextMsg(context, text, accessToken) {
    const data = JSON.stringify({
      recipient: {
        id: context.user.id,
      },
      message: {
        text: text.substring(0, 320),
      },
    });

    this.postData(data, accessToken);
  }

  sendQuickReplyMsg(context, text, quickReplies, accessToken) {
    const data = JSON.stringify({
      recipient: {
        id: context.user.id,
      },
      message: {
        text: text.substring(0, 320),
        quick_replies: quickReplies,
      },
    });

    this.postData(data, accessToken);
  }

  sendImageQuickReplyMsg(context, url, quickReplies, accessToken) {
    const data = JSON.stringify({
      recipient: {
        id: context.user.id,
      },
      message: {
        attachment: {
          type: 'image',
          payload: {
            url,
          },
        },
        quick_replies: quickReplies,
      },
    });

    this.postData(data, accessToken);
  }

  sendImageMsg(context, url, accessToken) {
    const data = JSON.stringify({
      recipient: {
        id: context.user.id,
      },
      message: {
        attachment: {
          type: 'image',
          payload: {
            url,
          },
        },
      },
    });

    this.postData(data, accessToken);
  }

  send(envelope, para, accessToken) {
    debug(chalk.red(new Date().toISOString()));
    debug(chalk.blue('trying to sending message..'));
    debug(chalk.blue(JSON.stringify(envelope, null, 2)));

    const type = para.type;
    const text = para.text;

    switch (type) {
      case 'button':
        return this.sendButtonMsg(envelope, text, para.buttons, accessToken);
      case 'text':
        return this.sendTextMsg(envelope, text, accessToken);
      case 'image':
        return this.sendImageMsg(envelope, text, accessToken);
      case 'quick_replies':
        return this.sendQuickReplyMsg(envelope, text, para.quick_replies, accessToken);
      case 'image_quick_replies':
        return this.sendImageQuickReplyMsg(envelope, text, para.quick_replies, accessToken);
      default:
        return;
    }
  }

  reply(envelope, ...strings) {
    return this.sendMsg(envelope, `${envelope.user.name}; ${strings.join('\n')}`);
  }

  run() {
    if (!this.verifyToken) {
      this.emit('error', new Error('You must configure the MESSENGER_VERIFY_TOKEN environment variable.'));
    }

    this.robot.router.get('/webhook/', (req, res) => {
      if (req.query['hub.verify_token'] === this.verifyToken) {
        res.send(req.query['hub.challenge']);
      }
      this.robot.logger.warning('hubot-messenger-bot: Wrong validation token.');
      res.send('Error, wrong validation token');
    });

    this.robot.router.post('/webhook/', (req, res) => {
      const msgEvents = req.body.entry[0].messaging;
      let msgEvent;
      for (let i = 0, len = msgEvents.length; i < len; i++) {
        msgEvent = msgEvents[i];
        this.processMsg(msgEvent);
      }
      return res.send(200);
    });
    this.robot.logger.info('hubot-messenger-bot: Adapter running.');
    return this.emit('connected');
  }
}

module.exports.use = robot => new Messenger(robot);
