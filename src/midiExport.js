const TICKS_PER_QUARTER = 480;
const MIDI_BARS = 16;
const MIDI_SELECTIONS = ["melody", "bass", "pad", "percussion"];

const TEXT_ENCODER = new TextEncoder();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(seedText) {
  let seed = 2166136261;

  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function noteNameToMidi(note) {
  if (typeof note === "number") {
    return clamp(Math.round(69 + 12 * Math.log2(note / 440)), 0, 127);
  }

  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);

  if (!match) {
    return 60;
  }

  const semitones = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };

  return clamp((Number(match[2]) + 1) * 12 + semitones[match[1]], 0, 127);
}

function transposePitchUpOctave(pitch) {
  if (typeof pitch === "number") {
    return pitch * 2;
  }

  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(pitch);

  return match ? `${match[1]}${Number(match[2]) + 1}` : pitch;
}

function pushNote(events, tick, duration, pitch, channel, velocity) {
  const note = noteNameToMidi(pitch);
  const safeTick = Math.max(0, Math.round(tick));
  const safeDuration = Math.max(1, Math.round(duration));

  events.push({
    tick: safeTick,
    order: 1,
    bytes: [0x90 + channel, note, velocity],
  });
  events.push({
    tick: safeTick + safeDuration,
    order: 0,
    bytes: [0x80 + channel, note, 0],
  });
}

function getSafeSettings(settings) {
  return {
    bpm: settings.bpm ?? 90,
    timeSignature: settings.timeSignature ?? [4, 4],
    tuning: settings.tuning ?? "12-TET",
    scale: settings.scale?.length ? settings.scale : ["C3", "D3", "G3", "A3"],
    bassNotes: settings.bassNotes?.length
      ? settings.bassNotes
      : ["C2", "G2", "A2", "G2"],
    padChordProgression: settings.padChordProgression?.length
      ? settings.padChordProgression
      : [["C3", "E3", "G3"]],
    melodyArpLength: settings.melodyArpLength ?? 3,
    melodySixteenthChance: settings.melodySixteenthChance ?? 0,
    melodyOctaveChance: settings.melodyOctaveChance ?? 0,
    lowPressurePercussion: settings.lowPressurePercussion ?? 0,
    highPressureDryness: settings.highPressureDryness ?? 0,
    rainIntensity: settings.rainIntensity ?? 0,
    windSpeed: settings.windSpeed ?? 0,
    isFoggy: settings.isFoggy ?? false,
    isRainy: settings.isRainy ?? false,
    isStormy: settings.isStormy ?? false,
    isSnowy: settings.isSnowy ?? false,
    isClear: settings.isClear ?? false,
  };
}

function buildMelodyEvents(settings, totalTicks, random) {
  const events = [];
  const stepTicks = TICKS_PER_QUARTER / 2;
  const eighthTicks = TICKS_PER_QUARTER / 2;
  const sixteenthTicks = TICKS_PER_QUARTER / 4;
  const duration = settings.tuning === "53-EDO" || settings.isFoggy
    ? TICKS_PER_QUARTER
    : eighthTicks;
  let melodyIndex = 0;
  let melodyStep = 0;

  for (let tick = 0; tick < totalTicks; tick += stepTicks) {
    const shouldSkipForSlowWind =
      settings.windSpeed <= 12 && melodyStep % 2 === 1;
    melodyStep += 1;

    if (shouldSkipForSlowWind) {
      continue;
    }

    const chance = settings.isFoggy
      ? 0.55
      : settings.isStormy || settings.isRainy
      ? 0.75
      : 0.88;

    if (random() < chance) {
      const arpLength = Math.max(3, Math.round(settings.melodyArpLength));
      const scaleStep = Math.max(1, settings.windSpeed > 10 ? 2 : 1);
      let noteTick = tick;

      for (let i = 0; i < arpLength && noteTick < totalTicks; i += 1) {
        const sourcePitch =
          settings.scale[(melodyIndex + i * scaleStep) % settings.scale.length];
        const pitch =
          random() < settings.melodyOctaveChance
            ? transposePitchUpOctave(sourcePitch)
            : sourcePitch;

        pushNote(events, noteTick, duration, pitch, 0, 92);
        noteTick +=
          random() < settings.melodySixteenthChance ? sixteenthTicks : eighthTicks;
      }
    }

    melodyIndex += settings.windSpeed > 10 ? 2 : 1;
  }

  return events;
}

function buildBassEvents(settings, totalTicks) {
  const events = [];
  const stepTicks = TICKS_PER_QUARTER * 2;
  let bassIndex = 0;
  let bassStep = 0;

  for (let tick = 0; tick < totalTicks; tick += stepTicks) {
    if (!settings.isStormy && bassStep % 2 === 1) {
      bassStep += 1;
      continue;
    }

    const pitch = settings.bassNotes[bassIndex % settings.bassNotes.length];
    const duration = settings.isStormy ? TICKS_PER_QUARTER : stepTicks;

    pushNote(events, tick, duration, pitch, 1, 88);
    bassIndex += 1;
    bassStep += 1;
  }

  return events;
}

function buildPadEvents(settings, totalTicks) {
  const events = [];
  const [numerator] = settings.timeSignature;
  const stepTicks = TICKS_PER_QUARTER * numerator * 2;
  let chordIndex = 0;

  for (let tick = 0; tick < totalTicks; tick += stepTicks) {
    const chord =
      settings.padChordProgression[
        chordIndex % settings.padChordProgression.length
      ];

    chord.forEach((pitch) => {
      pushNote(events, tick, stepTicks, pitch, 2, 72);
    });
    chordIndex += 1;
  }

  return events;
}

function buildPercussionEvents(settings, totalTicks, random) {
  const events = [];
  const stepTicks = TICKS_PER_QUARTER / 4;
  const lowPressure = settings.lowPressurePercussion;
  const highPressure = settings.highPressureDryness;

  for (let tick = 0; tick < totalTicks; tick += stepTicks) {
    if (settings.isRainy || settings.rainIntensity > 0 || settings.isStormy) {
      const baseChance = settings.isStormy
        ? 0.78
        : 0.2 + settings.rainIntensity * 0.5;
      const chance = clamp(
        baseChance + lowPressure * 0.4 - highPressure * 0.3,
        0,
        0.95
      );

      if (random() < chance) {
        pushNote(events, tick, stepTicks, 42, 9, 62);
      }
    }
  }

  for (let tick = 0; tick < totalTicks; tick += TICKS_PER_QUARTER * 2) {
    const accentChance = clamp(
      0.45 + lowPressure * 0.35 - highPressure * 0.28,
      0.18,
      0.72
    );

    if ((settings.isStormy || lowPressure > 0.45) && random() < accentChance) {
      pushNote(events, tick, TICKS_PER_QUARTER / 2, 38, 9, 84);
    }

    if (settings.isSnowy || settings.isClear) {
      const sparkleChance = settings.isSnowy ? 0.45 : 0.18;

      if (random() < sparkleChance) {
        pushNote(events, tick, TICKS_PER_QUARTER / 2, 81, 9, 64);
      }
    }
  }

  return events;
}

function writeVariableLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];

  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);

    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }

  return bytes;
}

function numberToBytes(value, byteCount, littleEndian = false) {
  const bytes = [];

  for (let i = 0; i < byteCount; i += 1) {
    const shift = littleEndian ? i * 8 : (byteCount - 1 - i) * 8;
    bytes.push((value >>> shift) & 0xff);
  }

  return bytes;
}

function textBytes(text) {
  return Array.from(TEXT_ENCODER.encode(text));
}

function buildTrack(settings, selection) {
  const [numerator, denominator] = settings.timeSignature;
  const totalTicks = MIDI_BARS * numerator * TICKS_PER_QUARTER;
  const random = seededRandom(
    `${selection}-${settings.bpm}-${settings.scale.join(",")}-${settings.windSpeed}`
  );
  const events = [
    {
      tick: 0,
      order: -4,
      bytes: [0xff, 0x03, ...writeVariableLength(selection.length), ...textBytes(selection)],
    },
    {
      tick: 0,
      order: -3,
      bytes: [
        0xff,
        0x51,
        0x03,
        ...numberToBytes(Math.round(60000000 / settings.bpm), 3),
      ],
    },
    {
      tick: 0,
      order: -2,
      bytes: [
        0xff,
        0x58,
        0x04,
        numerator,
        Math.log2(denominator),
        24,
        8,
      ],
    },
  ];

  if (selection !== "percussion") {
    const programBySelection = {
      melody: 10,
      bass: 38,
      pad: 88,
    };
    const channelBySelection = {
      melody: 0,
      bass: 1,
      pad: 2,
    };

    events.push({
      tick: 0,
      order: -1,
      bytes: [
        0xc0 + channelBySelection[selection],
        programBySelection[selection],
      ],
    });
  }

  if (selection === "melody") {
    events.push(...buildMelodyEvents(settings, totalTicks, random));
  } else if (selection === "bass") {
    events.push(...buildBassEvents(settings, totalTicks));
  } else if (selection === "pad") {
    events.push(...buildPadEvents(settings, totalTicks));
  } else {
    events.push(...buildPercussionEvents(settings, totalTicks, random));
  }

  events.push({
    tick: totalTicks,
    order: 99,
    bytes: [0xff, 0x2f, 0x00],
  });
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  let lastTick = 0;
  const trackBytes = [];

  events.forEach((event) => {
    trackBytes.push(...writeVariableLength(event.tick - lastTick));
    trackBytes.push(...event.bytes);
    lastTick = event.tick;
  });

  return trackBytes;
}

function buildMidi(settings, selection) {
  const safeSettings = getSafeSettings(settings);
  const track = buildTrack(safeSettings, selection);
  const bytes = [
    ...textBytes("MThd"),
    ...numberToBytes(6, 4),
    ...numberToBytes(0, 2),
    ...numberToBytes(1, 2),
    ...numberToBytes(TICKS_PER_QUARTER, 2),
    ...textBytes("MTrk"),
    ...numberToBytes(track.length, 4),
    ...track,
  ];

  return new Uint8Array(bytes);
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

function buildZip(files) {
  let offset = 0;
  const localParts = [];
  const centralParts = [];

  files.forEach((file) => {
    const nameBytes = new Uint8Array(textBytes(file.name));
    const data = file.data;
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      ...numberToBytes(0x04034b50, 4, true),
      ...numberToBytes(20, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(crc, 4, true),
      ...numberToBytes(data.length, 4, true),
      ...numberToBytes(data.length, 4, true),
      ...numberToBytes(nameBytes.length, 2, true),
      ...numberToBytes(0, 2, true),
    ]);
    const centralHeader = new Uint8Array([
      ...numberToBytes(0x02014b50, 4, true),
      ...numberToBytes(20, 2, true),
      ...numberToBytes(20, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(crc, 4, true),
      ...numberToBytes(data.length, 4, true),
      ...numberToBytes(data.length, 4, true),
      ...numberToBytes(nameBytes.length, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 2, true),
      ...numberToBytes(0, 4, true),
      ...numberToBytes(offset, 4, true),
    ]);

    localParts.push(localHeader, nameBytes, data);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array([
    ...numberToBytes(0x06054b50, 4, true),
    ...numberToBytes(0, 2, true),
    ...numberToBytes(0, 2, true),
    ...numberToBytes(files.length, 2, true),
    ...numberToBytes(files.length, 2, true),
    ...numberToBytes(centralDirectory.length, 4, true),
    ...numberToBytes(offset, 4, true),
    ...numberToBytes(0, 2, true),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function downloadBytes(bytes, filename, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadMidi(settings, selection) {
  if (selection === "all") {
    const files = MIDI_SELECTIONS.map((instrument) => ({
      name: `weather-music-${instrument}.mid`,
      data: buildMidi(settings, instrument),
    }));

    downloadBytes(buildZip(files), "weather-music-midi.zip", "application/zip");
    return;
  }

  downloadBytes(
    buildMidi(settings, selection),
    `weather-music-${selection}.mid`,
    "audio/midi"
  );
}
