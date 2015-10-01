//================================
// Simple ServiceBus Topic test - takes in a JSON settings file
// containing settings for connecting to the Topic:
// - protocol: should never be set, defaults to amqps
// - SASKeyName: name of your SAS key which should allow send/receive
// - SASKey: actual SAS key value
// - serviceBusHost: name of the host without suffix (e.g. https://foobar-ns.servicebus.windows.net/foobart => foobar-ns)
// - topicName: name of the topic (e.g. https://foobar-ns.servicebus.windows.net/foobart => foobart)
// - subscriptionName: name of the subscription for the topic (e.g. https://foobar-ns.servicebus.windows.net/foobart/Subscriptions/foobars => foobars)
//
// Will set up a receiver, then send a message and exit when that message is received.
//================================

'use strict';
//var AMQPClient = require('amqp10').Client;
var AMQPClient  = require('../lib').Client,
    Policy = require('../lib').Policy,
    util = require('util');

var settingsFile = process.argv[2];
var settings = {};
if (settingsFile) {
  settings = require('./' + settingsFile);
} else {
  settings = {
    serviceBusHost: process.env.ServiceBusNamespace,
    topicName: process.env.ServiceBusTopicName,
    subscriptionName: process.env.ServiceBusTopicSubscriptionName,
    SASKeyName: process.env.ServiceBusTopicKeyName,
    SASKey: process.env.ServiceBusTopicKey
  };
}

if (!settings.serviceBusHost || !settings.topicName || !settings.subscriptionName || !settings.SASKeyName || !settings.SASKey) {
  console.warn('Must provide either settings json file or appropriate environment variables.');
  process.exit(1);
}

var protocol = settings.protocol || 'amqps';
var serviceBusHost = settings.serviceBusHost + '.servicebus.windows.net';
if (settings.serviceBusHost.indexOf(".") !== -1) {
  serviceBusHost = settings.serviceBusHost;
}

var sasName = settings.SASKeyName;
var sasKey = settings.SASKey;
var topicName = settings.topicName;
var subscriptionName = settings.subscriptionName;

var msgVal = Math.floor(Math.random() * 10000);
var uri = protocol + '://' + encodeURIComponent(sasName) + ':' + encodeURIComponent(sasKey) + '@' + serviceBusHost;
var client = new AMQPClient(Policy.ServiceBusTopic);

client.connect(uri)
  .then(function () {
    return Promise.all([
      client.createSender(topicName),
      client.createReceiver(topicName + '/Subscriptions/' + subscriptionName)
    ]);
  })
  .spread(function(sender, receiver) {
    // error handling
    sender.on('errorReceived', function(tx_err) {
      console.warn('===> TX ERROR: ', tx_err);
    });
    receiver.on('errorReceived', function(rx_err) {
      console.warn('===> RX ERROR: ', rx_err);
    });

    // message event handler
    receiver.on('message', function(message) {
      console.log('Recv: ' + util.inspect(message));

      if (message.body.DataValue === msgVal) {
        client.disconnect().then(function () {
          console.log("Disconnected, when we saw the value we'd inserted.");
          process.exit(0);
        });
      }
    });

    // send test message
    return sender.send({"DataString": "From Node", "DataValue": msgVal});
  })
  .then(function(state) {
    console.log('State: ', state);
  })
  .catch(function (e) {
    console.warn('Error send/receive: ', e);
  });
