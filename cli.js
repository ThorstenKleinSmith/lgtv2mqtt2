#!/usr/bin/env node

import mqtt from "mqtt";

import LgTvController from "./vendor/LgTvController.js";
import Events from "./vendor/Events.js";

import { readConfig, getConfig } from "./get-config.js";

const CONFIG = readConfig("/etc/lgtv-config.json");
const MQTT_CONFIG = getConfig(CONFIG, {
  host: null,
  port: 1883,
  username: null,
  password: null,
});
const LGTV_CONFIG = getConfig(CONFIG, {
  name: "tv",
  ip: null,
  mac: null,
  lgtv_base_topic: "lgtv2mqtt",
});
const HA_CONFIG = getConfig(CONFIG, {
  ha_base_topic: "homeassistant",
});

const HA_DEVICE = {
  "connections":  [["mac", LGTV_CONFIG.mac]],
  "identifiers":  ["jarvis_lgtv_" + LGTV_CONFIG.mac],
  "manufacturer": "jarvis",
  "model":        "LG WebOS lgtv2mqtt",
  "name":         LGTV_CONFIG.name,
};

const HA_POWER_STATE_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_powerstate",
  name: LGTV_CONFIG.name + " Power State",
  device: HA_DEVICE,
  icon: "mdi:power",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  value_template: "{{ value_json.state }}",
};

const HA_POWER_SWITCH = {
  unique_id: LGTV_CONFIG.name + "_power",
  name: LGTV_CONFIG.name + " Power",
  device: HA_DEVICE,
  icon: "mdi:power",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  value_template: "{{ 'on' if value_json.state == 'Active' else 'off' }}",
  state_off: "off",
  state_on: "on",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "power"].join("/"),
  command_template: "{{ value }}",
  payload_off: "off",
  payload_on: "on",
};
const HA_POWER_OFF_BUTTON = {
  unique_id: LGTV_CONFIG.name + "_poweroff",
  name: LGTV_CONFIG.name + " Power Off",
  device: HA_DEVICE,
  icon: "mdi:power",
  availability_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  availability_template: "{{ 'online' if value_json.state == 'Active' else 'offline' }}",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "power"].join("/"),
  command_template: "{{ value }}",
  payload_press: "off",
};

const HA_APPID_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_appid",
  name: LGTV_CONFIG.name + " App ID",
  device: HA_DEVICE,
  icon: "mdi:application",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "foregroundApp"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "foregroundApp"].join("/"),
  value_template: "{{ value_json.appId }}",
};

const APPID_NAME_ENTRIES = [
  ["com.webos.app.home",         "Home"],
  ["netflix",                    "Netflix"],
  ["amazon",                     "Prime Video"],
  ["com.disney.disneyplus-prod", "Disney+"],
  ["com.fvp.ch4",                "4"],
  ["demand5",                    "my5"],
  ["com.fvp.itv",                "itvX"],
  ["com.fvp.fve",                "Freeview Play"],
  ["ui30",                       "Rakuten TV"],
  ["com.webos.app.lgchannels",   "LG Channels"],
  ["com.apple.appletv",          "Apple TV"],
  ["bbc.iplayer.3.0",            "BBC iPlayer"],
  ["com.webos.app.livetv",       "Live TV"],
  ["youtube.leanback.v4",        "YouTube"],
  ["cdp-30",                     "Plex"],
  ["bbc.sounds.1.0",             "BBC Sounds"],
  ["com.webos.app.hdmi1",        "PlayStation 4"],
  ["com.webos.app.hdmi3",        "PlayStation 3"],
];
const APPID_NAMES        = APPID_NAME_ENTRIES.map(([_k, v]) => v);
const APPID_NAME_MAP_STR = "{" + APPID_NAME_ENTRIES.map(([k, v]) => `'${k}': '${v}'`).join(",") + "}";
const NAME_APPID_MAP     = Object.fromEntries(APPID_NAME_ENTRIES.map(([k, v]) => [v, k]));

const HA_APPLICATION_SELECT = {
  unique_id: LGTV_CONFIG.name + "_application",
  name: LGTV_CONFIG.name + " Application",
  device: HA_DEVICE,
  icon: "mdi:application",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "foregroundApp"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "foregroundApp"].join("/"),
  // value_template: "{{ value_json.appId }}",
  value_template: `{{ ${APPID_NAME_MAP_STR}.get(value_json.appId, 'Unknown') }}`,
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "application"].join("/"),
  options: [...APPID_NAMES, 'Unknown'],
};

const HA_LIVE_TV_CHANNEL_NAME_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_livetvchannelname",
  name: LGTV_CONFIG.name + " Live TV Channel Name",
  device: HA_DEVICE,
  icon: "mdi:television-classic",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  value_template: "{{ value_json.channelName }}",
};

const HA_LIVE_TV_CHANNEL_NUMBER_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_livetvchannelnumber",
  name: LGTV_CONFIG.name + " Live TV Channel Number",
  device: HA_DEVICE,
  icon: "mdi:television-classic",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  value_template: "{{ value_json.channelNumber }}",
};

const HA_LIVE_TV_CHANNEL_ID_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_livetvchannelid",
  name: LGTV_CONFIG.name + " Live TV Channel ID",
  device: HA_DEVICE,
  icon: "mdi:television-classic",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  value_template: "{{ value_json.channelId }}",
};

const LIVE_TV_CHANNELID_NAME_ENTRIES = [
  [13, "1_26_13_13_8197_8448_9018", "E4"],
  [30, "1_26_30_30_8197_8458_9018", "E4+1"],
];
const LIVE_TV_CHANNELID_NAMES        = LIVE_TV_CHANNELID_NAME_ENTRIES.map(([_k1, _k2, v]) => v);
const LIVE_TV_CHANNELID_NAME_MAP_STR = "{" + LIVE_TV_CHANNELID_NAME_ENTRIES.map(([k1, k2, v]) => `'${k1}/${k2}': '${v}'`).join(",") + "}";
const NAME_LIVE_TV_CHANNELID_MAP     = Object.fromEntries(LIVE_TV_CHANNELID_NAME_ENTRIES.map(([k1, k2, v]) => [v, {number: k1, id: k2}]));

const HA_LIVE_TV_CHANNEL_SELECT = {
  unique_id: LGTV_CONFIG.name + "_livetvchannel",
  name: LGTV_CONFIG.name + " Live TV Channel",
  device: HA_DEVICE,
  icon: "mdi:television-classic",
  availability_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "foregroundApp"].join("/"),
  availability_template: "{{ 'online' if value_json.appId == 'com.webos.app.livetv' else 'offline' }}",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "liveTvChannel"].join("/"),
  // value_template: "{{ value_json.channelNumber ~ '/' ~ value_json.channelId }}",
  value_template: `{{ ${LIVE_TV_CHANNELID_NAME_MAP_STR}.get(value_json.channelNumber ~ '/' ~ value_json.channelId, 'Unknown') }}`,
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "liveTvChannel"].join("/"),
  options: [...LIVE_TV_CHANNELID_NAMES, 'Unknown'],
};

const HA_VOLUME_NUMBER = {
  unique_id: LGTV_CONFIG.name + "_volume",
  name: LGTV_CONFIG.name + " Volume",
  device: HA_DEVICE,
  icon: "mdi:volume-high",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  min: 0,
  max: 100,
  step: 1,
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  value_template: "{{ value_json.volume }}",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "volume"].join("/"),
  command_template: "{{ value }}",
};
const HA_VOLUME_UP_BUTTON = {
  unique_id: LGTV_CONFIG.name + "_volumeup",
  name: LGTV_CONFIG.name + " Volume Up",
  device: HA_DEVICE,
  icon: "mdi:volume-plus",
  availability_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  availability_template: "{{ 'online' if value_json.state == 'Active' else 'offline' }}",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "volume"].join("/"),
  command_template: "{{ value }}",
  payload_press: "up",
};
const HA_VOLUME_DOWN_BUTTON = {
  unique_id: LGTV_CONFIG.name + "_volumedown",
  name: LGTV_CONFIG.name + " Volume Up",
  device: HA_DEVICE,
  icon: "mdi:volume-minus",
  availability_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "powerState"].join("/"),
  availability_template: "{{ 'online' if value_json.state == 'Active' else 'offline' }}",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "volume"].join("/"),
  command_template: "{{ value }}",
  payload_press: "down",
};

const HA_MUTE_SWITCH = {
  unique_id: LGTV_CONFIG.name + "_mute",
  name: LGTV_CONFIG.name + " Mute",
  device: HA_DEVICE,
  icon: "mdi:volume-mute",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  value_template: "{{ 'on' if value_json.muteStatus else 'off' }}",
  state_off: "off",
  state_on: "on",
  command_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", "mute"].join("/"),
  command_template: "{{ value }}",
  payload_off: "off",
  payload_on: "on",
};

const HA_SOUND_OUTPUT_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_soundoutput",
  name: LGTV_CONFIG.name + " Sound Output",
  device: HA_DEVICE,
  icon: "mdi:surround-sound",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "audioStatus"].join("/"),
  value_template: "{{ value_json.soundOutput }}",
};

const HA_SOUND_MODE_SENSOR = {
  unique_id: LGTV_CONFIG.name + "_soundmode",
  name: LGTV_CONFIG.name + " Sound Mode",
  device: HA_DEVICE,
  icon: "mdi:surround-sound",
  json_attributes_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "soundSettings"].join("/"),
  json_attributes_template: "{{ value_json | tojson }}",
  state_topic: [LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "soundSettings"].join("/"),
  value_template: "{{ value_json.soundMode }}",
};

const mqttClient = mqtt.connect(MQTT_CONFIG);

const lg = new LgTvController(LGTV_CONFIG.ip, LGTV_CONFIG.mac, LGTV_CONFIG.name, "/etc/lgtv-keyfile");
lg.connect();

const onLgEvents = {
  [Events.TV_TURNED_ON]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },
  [Events.TV_TURNED_OFF]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },
  [Events.PIXEL_REFRESHER_STARTED]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },
  [Events.SCREEN_STATE_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },
  [Events.SCREEN_SAVER_TURNED_ON]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },
  [Events.POWER_STATE_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("powerState", value);
  },

  [Events.AUDIO_STATUS_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("audioStatus", value.volumeStatus);
  },
  [Events.SOUND_SETTINGS_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("soundSettings", value);
  },

  [Events.PICTURE_SETTINGS_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("pictureSettings", value);
  },

  [Events.FOREGROUND_APP_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("foregroundApp", value);
  },

  [Events.LIVE_TV_CHANNEL_CHANGED]: (value) => {
    publishLgtvMqttMessageAsync("liveTvChannel", value);
  },

  [Events.SETUP_FINISHED]: () => {
    console.log("setup finished!");
    console.log("list of external inputs:\n",
                lg.getExternalInputList());
    // console.log("list of apps:\n", lg.getAllAppsList());
  },
};

Object.entries(onLgEvents).forEach(([event, handler]) => {
  lg.on(event, (value) => {
    console.log("got lg event:", event, "with value:", value);
    handler(value);
  });
});

const onMqttEvents = {
  power: {
    onMqttMessage: (value) => {
      if (value === "on") {
        lg.turnOn();
      }
      if (value === "off") {
        lg.turnOff();
      }
    },
  },

  volume: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      if (value === "up") {
        lg.volumeUp();
      } else if (value === "down") {
        lg.volumeDown();
      } else {
        const volumeLevel = parseInt(value);
        lg.setVolumeLevel(volumeLevel);
      }
    },
  },
/*
  soundOutput: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      lg.changeSoundOutput(value);
    },
  },
*/
  mute: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      lg.setMute(value === "on");
    },
  },

  screen: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      if (value === "on") {
        lg.turnOnTvScreen();
      }
      if (value === "off") {
        lg.turnOffTvScreen();
      }
    },
  },
/*
  appId: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      const appId = NAME_APPID_MAP[value];
      if (appId) {
        lg.launchApp(appId);
      }
    },
  },
*/
  application: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn()) {
        return;
      }

      const appId = NAME_APPID_MAP[value];
      if (appId) {
        lg.launchApp(appId);
      }
    },
  },

  liveTvChannel: {
    onMqttMessage: (value) => {
      if (!lg.isTvOn() || !lg.isLiveTvActive()) {
        return;
      }

      const liveTvChannelNumberId = NAME_LIVE_TV_CHANNELID_MAP[value];
      if (liveTvChannelNumberId) {
        const liveTvChannelNumber = liveTvChannelNumberId.number;
        const liveTvChannelId = liveTvChannelNumberId.id;
        lg.openLiveTvChannel(liveTvChannelNumber, liveTvChannelId);
      }
    },
  },
}

mqttClient.on("connect", () => {
  publishHAMqttMessageSync("sensor", "powerstate", HA_POWER_STATE_SENSOR);
  publishHAMqttMessageSync("switch", "power", HA_POWER_SWITCH);
  publishHAMqttMessageSync("button", "poweroff", HA_POWER_OFF_BUTTON);
  publishHAMqttMessageSync("sensor", "appid", HA_APPID_SENSOR);
  publishHAMqttMessageSync("select", "appid", HA_APPLICATION_SELECT);
  publishHAMqttMessageSync("sensor", "livetvchannelname", HA_LIVE_TV_CHANNEL_NAME_SENSOR);
  publishHAMqttMessageSync("sensor", "livetvchannelnumber", HA_LIVE_TV_CHANNEL_NUMBER_SENSOR);
  publishHAMqttMessageSync("sensor", "livetvchannelid", HA_LIVE_TV_CHANNEL_ID_SENSOR);
  publishHAMqttMessageSync("select", "livetvchannel", HA_LIVE_TV_CHANNEL_SELECT);
  publishHAMqttMessageSync("number", "volume", HA_VOLUME_NUMBER);
  publishHAMqttMessageSync("button", "volumeup", HA_VOLUME_UP_BUTTON);
  publishHAMqttMessageSync("button", "volumedown", HA_VOLUME_DOWN_BUTTON);
  publishHAMqttMessageSync("switch", "mute", HA_MUTE_SWITCH);
  publishHAMqttMessageSync("sensor", "soundoutput", HA_SOUND_OUTPUT_SENSOR);
  publishHAMqttMessageSync("sensor", "soundmode", HA_SOUND_MODE_SENSOR);

  Object.keys(onMqttEvents).forEach((topic) => {
    console.log("subscribing to MQTT topic:", topic);
    mqttClient.subscribe([LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", topic].join("/"));
  });
});

mqttClient.on("message", (topic, message) => {
  topic = topic.replace([LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, "cmnd", ""].join("/"), "");
  const mqttValue = message.toString();

  if (!onMqttEvents[topic]) {
    console.log(`no config for topic: '${topic}'`);
    return;
  }

  console.log(
    "got mqtt message for topic:",
    topic,
    "with value:",
    mqttValue
  );

  onMqttEvents[topic].onMqttMessage(mqttValue);
});

function publishLgtvMqttMessageAsync(topic, value) {
  mqttClient.publishAsync([LGTV_CONFIG.lgtv_base_topic, LGTV_CONFIG.name, topic].join("/"),
                          JSON.stringify(value),
                          { retain: true }
                         );
}

function publishHAMqttMessageSync(category, name, value) {
  const topic = [HA_CONFIG.ha_base_topic, category, LGTV_CONFIG.name, name, "config"].join("/");
  mqttClient.publish(topic,
                     JSON.stringify(value),
                     { retain: true }
                    );
}
