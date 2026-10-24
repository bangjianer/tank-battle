/* 8-bit 风格音效：全部用 WebAudio 实时合成，无需任何音频资源文件 */
window.SFX = (function () {
  'use strict';

  var ac = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var lastShot = 0;

  function init() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ac = new AC();
    } catch (e) {
      return null;
    }
    master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);

    var len = Math.floor(ac.sampleRate * 0.5);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ac;
  }

  function unlock() {
    var a = init();
    if (a && a.state === 'suspended') a.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    var a = init();
    if (!a) return;
    var t0 = a.currentTime;
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol, cutoffFrom, cutoffTo) {
    if (muted) return;
    var a = init();
    if (!a || !noiseBuf) return;
    var t0 = a.currentTime;
    var src = a.createBufferSource();
    src.buffer = noiseBuf;
    var filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFrom || 1800, t0);
    if (cutoffTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffTo), t0 + dur);
    var g = a.createGain();
    g.gain.setValueAtTime(Math.max(0.001, vol || 0.3), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    unlock: unlock,

    shoot: function () {
      var now = performance.now();
      if (now - lastShot < 45) return;
      lastShot = now;
      tone(880, 0.07, 'square', 0.14, 240);
      noise(0.06, 0.06, 3000, 600);
    },

    brick: function () {
      noise(0.09, 0.16, 2400, 400);
    },

    steel: function () {
      tone(1500, 0.05, 'square', 0.1, 900);
      noise(0.06, 0.1, 4000, 1200);
    },

    explode: function (big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 1600 : 2200, 90);
      if (big) tone(140, 0.35, 'sawtooth', 0.16, 40);
    },

    power: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        (function (n, i) {
          setTimeout(function () {
            tone(n, 0.1, 'square', 0.15);
          }, i * 60);
        })(notes[i], i);
      }
    },

    stageStart: function () {
      tone(392, 0.12, 'square', 0.16);
      setTimeout(function () { tone(523, 0.12, 'square', 0.16); }, 130);
      setTimeout(function () { tone(784, 0.2, 'square', 0.16); }, 260);
    },

    stageClear: function () {
      var seq = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < seq.length; i++) {
        (function (n, i) {
          setTimeout(function () { tone(n, 0.16, 'triangle', 0.18); }, i * 110);
        })(seq[i], i);
      }
    },

    gameOver: function () {
      var seq = [392, 330, 262, 175];
      for (var i = 0; i < seq.length; i++) {
        (function (n, i) {
          setTimeout(function () { tone(n, 0.28, 'sawtooth', 0.2); }, i * 190);
        })(seq[i], i);
      }
    },

    life: function () {
      tone(660, 0.09, 'triangle', 0.18);
      setTimeout(function () { tone(990, 0.12, 'triangle', 0.18); }, 90);
    },

    toggleMute: function () {
      muted = !muted;
      return muted;
    },

    isMuted: function () {
      return muted;
    }
  };
})();
