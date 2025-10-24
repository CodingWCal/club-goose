import * as Tone from 'tone';
import { setIndividualLayer } from '../state';

// Buses - created once on init
let masterBus: Tone.Gain | null = null;
let leadBus: Tone.Gain | null = null;
let chordsBus: Tone.Gain | null = null;
let bassBus: Tone.Gain | null = null;
let kickBus: Tone.Gain | null = null;
let snareBus: Tone.Gain | null = null;
let hatsBus: Tone.Gain | null = null;

// FX
let leadReverb: Tone.Reverb | null = null;
let leadDelay: Tone.PingPongDelay | null = null;
let masterCompressor: Tone.Compressor | null = null;
let masterLimiter: Tone.Limiter | null = null;

// Instruments
let leadSynth: Tone.PolySynth | null = null;
let chordsSynth: Tone.PolySynth | null = null;
let bassSynth: Tone.MonoSynth | null = null;
let kickSynth: Tone.MembraneSynth | null = null;
let snareSynth: Tone.NoiseSynth | null = null;
let snareFilter: Tone.Filter | null = null;
let hatsSynth: Tone.MetalSynth | null = null;
let hatsFilter: Tone.Filter | null = null;

// Loops
let leadLoop: Tone.Loop | null = null;
let chordsLoop: Tone.Loop | null = null;
let bassLoop: Tone.Loop | null = null;
let kickLoop: Tone.Loop | null = null;
let snareLoop: Tone.Loop | null = null;
let hatsLoop: Tone.Loop | null = null;

// Metronome for dev
let __metro: Tone.Loop | null = null;

let isInitialized = false;

// A minor pentatonic scale for lead
const AMINOR_PENTATONIC = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

// Extended A minor scale for more melodic variety
const AMINOR_SCALE = ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'];

// EDM House lead melody patterns - melodic and danceable
const LEAD_MELODY_PATTERNS = [
  // Pattern 1: Classic house arpeggio (Am pentatonic)
  ['A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A4', 'E4', 'A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A4', 'E4'],
  
  // Pattern 2: Melodic house with passing tones
  ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'D5', 'C5', 'A4', 'G4', 'E4', 'D4', 'C4'],
  
  // Pattern 3: Deep house with sustained notes
  ['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'G5', 'E5', 'C5', 'A4', 'G4', 'E4', 'C4'],
  
  // Pattern 4: Progressive house build
  ['A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'E5', 'C5', 'A4', 'E4', 'C4', 'A3', 'C4', 'E4', 'A4'],
  
  // Pattern 5: Tech house minimal
  ['A3', 'E4', 'A4', 'E5', 'A5', 'E5', 'A4', 'E4', 'A3', 'E4', 'A4', 'E5', 'A5', 'E5', 'A4', 'E4'],
  
  // Pattern 6: Melodic EDM with hooks
  ['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'G5', 'E5', 'C5', 'A4', 'G4', 'E4', 'C4']
];

// EDM House rhythm patterns - danceable and melodic
const LEAD_RHYTHM_PATTERNS = [
  // Pattern 1: Classic house rhythm (steady 8th notes)
  ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'],
  
  // Pattern 2: House with syncopation
  ['8n', '8n', '4n', '8n', '8n', '8n', '4n', '8n', '8n', '8n', '4n', '8n', '8n', '8n', '4n', '8n'],
  
  // Pattern 3: Melodic house with sustained notes
  ['4n', '8n', '8n', '4n', '8n', '8n', '4n', '8n', '8n', '4n', '8n', '8n', '4n', '8n', '8n', '4n'],
  
  // Pattern 4: Progressive house build
  ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'],
  
  // Pattern 5: Tech house minimal
  ['4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n', '4n'],
  
  // Pattern 6: EDM with hooks
  ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n']
];

// 4-bar chord progression (Am-F-C-G)
const CHORD_PROGRESSION = [
  ['A3', 'C4', 'E4'], // Am
  ['F3', 'A3', 'C4'], // F
  ['C3', 'E3', 'G3'], // C
  ['G3', 'B3', 'D4']  // G
];

// 7th chord variations for chords
const CHORD_PROGRESSION_7TH = [
  ['A3', 'C4', 'E4', 'G4'], // Am7
  ['F3', 'A3', 'C4', 'E4'], // Fmaj7
  ['C3', 'E3', 'G3', 'B3'], // Cmaj7
  ['G3', 'B3', 'D4', 'F4']  // G7
];

// Root notes for bass (C2/G1 roots as requested)
const BASS_ROOTS = ['C2', 'G1', 'C2', 'G1'];

// Drum patterns with variation (16th note steps)
const kickPattern = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]; // 1, 9 with occasional 11
const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]; // 5, 13
const hatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]; // Every 8th with 20% rests

export function initInstruments(): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    // Set up transport with swing
    Tone.Transport.swing = 0.15;
    Tone.Transport.swingSubdivision = '16n';

    // Set up master destination
    Tone.Destination.mute = false;
    Tone.Destination.volume.value = 0;

    // Create master bus with FX
    masterBus = new Tone.Gain(1);
    masterCompressor = new Tone.Compressor({
      threshold: -14,
      ratio: 3,
      attack: 0.003,
      release: 0.1
    });
    masterLimiter = new Tone.Limiter(-1);
    
    // Chain: masterBus -> compressor -> limiter -> destination
    masterBus.connect(masterCompressor);
    masterCompressor.connect(masterLimiter);
    masterLimiter.toDestination();

    // Create individual part buses
    leadBus = new Tone.Gain(0.8).connect(masterBus);
    chordsBus = new Tone.Gain(0.7).connect(masterBus);
    bassBus = new Tone.Gain(0.9).connect(masterBus);
    kickBus = new Tone.Gain(1.0).connect(masterBus);
    snareBus = new Tone.Gain(0.8).connect(masterBus);
    hatsBus = new Tone.Gain(0.8).connect(masterBus);

    // Add FX to lead bus
    leadReverb = new Tone.Reverb({
      decay: 2.8,
      wet: 0.15
    });
    leadDelay = new Tone.PingPongDelay('8n', 0.25);
    leadDelay.wet.value = 0.12;

    // Chain: leadBus -> delay -> reverb -> masterBus
    leadBus.connect(leadDelay);
    leadDelay.connect(leadReverb);
    leadReverb.connect(masterBus);

    // Add FX to chords bus with toned settings
    const chordsReverb = new Tone.Reverb({
      decay: 2.8,
      wet: 0.1  // 0.08-0.12 range
    });
    const chordsDelay = new Tone.PingPongDelay('8n', 0.25);
    chordsDelay.wet.value = 0.08; // 0.06-0.1 range

    // Chain: chordsBus -> delay -> reverb -> masterBus
    chordsBus.connect(chordsDelay);
    chordsDelay.connect(chordsReverb);
    chordsReverb.connect(masterBus);

    // Create instruments
    // Lead: PolySynth with more expressive settings
    leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sawtooth'
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.4,
        release: 0.6
      }
    });

    // Add enhanced effects chain to lead synth
    const leadFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 1500,
      Q: 2
    });
    
    // Add a subtle chorus for richness
    const leadChorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.3
    });
    
    // Add a subtle phaser for movement
    const leadPhaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 1000,
      wet: 0.2
    });
    
    // Chain: leadSynth -> filter -> chorus -> phaser -> leadBus
    leadSynth.connect(leadFilter);
    leadFilter.connect(leadChorus);
    leadChorus.connect(leadPhaser);
    leadPhaser.connect(leadBus);

    // Chords: PolySynth for chord progression with improved sound
    chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.015, // ~15ms attack
        decay: 0.25,   // ~250ms decay
        sustain: 0.7,
        release: 0.5   // ~500ms release
      }
    });
    
    // Lower the volume of chords
    chordsSynth.volume.value = -6; // Reduce by 6dB

    // Add filters to chords synth chain
    const chordsLowPass = new Tone.Filter(1200, "lowpass", -12);
    const chordsHighPass = new Tone.Filter(280, "highpass", -12);
    
    // Chain: chordsSynth -> highpass -> lowpass -> chordsBus
    chordsSynth.connect(chordsHighPass);
    chordsHighPass.connect(chordsLowPass);
    chordsLowPass.connect(chordsBus);

    // Bass: MonoSynth with low-pass filter (C2/G1 roots, clean and low)
    bassSynth = new Tone.MonoSynth({
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.1,
        release: 0.2
      },
      filter: {
        type: 'lowpass',
        frequency: 120,
        Q: 1
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.1,
        release: 0.2
      }
    });
    bassSynth.connect(bassBus);

    // Kick: tuned MembraneSynth
    kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 6,
      envelope: { 
        attack: 0.001, 
        decay: 0.3, 
        sustain: 0, 
        release: 0.1 
      }
    }).connect(kickBus);

    // Snare: NoiseSynth with short decay and bandpass
    snareSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { 
        attack: 0.001, 
        decay: 0.15, 
        sustain: 0 
      }
    });
    snareFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: 5000,
      Q: 1
    });
    snareSynth.connect(snareFilter);
    snareFilter.connect(snareBus);

    // Hats: MetalSynth with HPF & very short decay
    hatsSynth = new Tone.MetalSynth({
      envelope: { 
        attack: 0.001, 
        decay: 0.1, 
        sustain: 0 
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    });
    hatsSynth.frequency.value = 200;
    hatsFilter = new Tone.Filter({
      type: 'highpass',
      frequency: 8000,
      Q: 0.5
    });
    hatsSynth.connect(hatsFilter);
    hatsFilter.connect(hatsBus);


    // Helper to find closest note in pentatonic scale
    const findClosestPentatonic = (note: Tone.Unit.Note): Tone.Unit.Note => {
      const noteNum = Tone.Frequency(note).toMidi();
      let closestNote = AMINOR_PENTATONIC[0] as Tone.Unit.Note;
      let closestDistance = Math.abs(Tone.Frequency(closestNote).toMidi() - noteNum);

      for (const pentatonicNote of AMINOR_PENTATONIC) {
        const distance = Math.abs(Tone.Frequency(pentatonicNote).toMidi() - noteNum);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNote = pentatonicNote as Tone.Unit.Note;
        }
      }
      return closestNote;
    };

    // Create loops for each part
    // Lead loop - sophisticated melody with multiple patterns
    let leadStep = 0;
    let leadPatternIndex = 0;
    let leadRhythmIndex = 0;
    let leadCycleCount = 0;
    
    leadLoop = new Tone.Loop((time) => {
      if (leadSynth) {
        // Get current melody and rhythm patterns
        const melodyPattern = LEAD_MELODY_PATTERNS[leadPatternIndex % LEAD_MELODY_PATTERNS.length];
        const rhythmPattern = LEAD_RHYTHM_PATTERNS[leadRhythmIndex % LEAD_RHYTHM_PATTERNS.length];
        
        // Get current note and rhythm
        const noteIndex = leadStep % melodyPattern.length;
        const note = melodyPattern[noteIndex] as Tone.Unit.Note;
        const rhythm = rhythmPattern[noteIndex] as Tone.Unit.Time;
        
        // Add some harmonic variation based on chord progression
        const chordIndex = Math.floor(leadStep / 4) % CHORD_PROGRESSION.length;
        const currentChord = CHORD_PROGRESSION[chordIndex];
        
        // Rarely harmonize with chord tones (5% chance) for subtlety
        let finalNote = note;
        if (Math.random() < 0.05 && currentChord.length > 0) {
          const chordNote = currentChord[Math.floor(Math.random() * currentChord.length)] as Tone.Unit.Note;
          // Blend chord note with melody note (octave up for harmony)
          const chordOctave = Tone.Frequency(chordNote).transpose(12).toNote();
          finalNote = Math.random() < 0.5 ? note : chordOctave as Tone.Unit.Note;
        }
        
        // Minimal pitch variations for subtle expression
        const pitchVariation = (Math.sin(leadStep * 0.05) * 0.02); // Much smaller variation
        const variedNote = Tone.Frequency(finalNote).transpose(pitchVariation).toNote();
        
        // Steady velocity with minimal variation
        const baseVelocity = 0.6;
        const accentVelocity = (leadStep % 4 === 0) ? 0.1 : 0; // Subtle accent on beat
        const velocity = baseVelocity + accentVelocity;
        
        // Simple, clean note trigger - no ornaments
        leadSynth.triggerAttackRelease(variedNote, rhythm, time, velocity);
        
        leadStep++;
        
        // Change patterns every 32 steps (8 bars) for slower, more relaxed changes
        if (leadStep % 32 === 0) {
          leadPatternIndex++;
          leadRhythmIndex++;
          leadCycleCount++;
          
          // Every 2 cycles (16 bars), reset to create longer phrases
          if (leadCycleCount % 2 === 0) {
            leadPatternIndex = 0;
            leadRhythmIndex = 0;
            console.log('🎵 Lead melody: Starting new phrase cycle');
          } else {
            console.log(`🎵 Lead melody: Pattern ${leadPatternIndex % LEAD_MELODY_PATTERNS.length + 1}, Rhythm ${leadRhythmIndex % LEAD_RHYTHM_PATTERNS.length + 1}`);
          }
        }
      }
    }, '8n'); // 8th notes for proper EDM house rhythm

    // Chords loop - plays chords every 2 beats
    let chordsStep = 0;
    chordsLoop = new Tone.Loop((time) => {
      if (chordsSynth) {
        const chordIndex = Math.floor(chordsStep / 2) % CHORD_PROGRESSION_7TH.length;
        const chord = CHORD_PROGRESSION_7TH[chordIndex];
        chordsSynth.triggerAttackRelease(chord, '2n', time);
      }
      chordsStep++;
    }, '2n');

    // Bass loop - plays root notes every beat
    let bassStep = 0;
    bassLoop = new Tone.Loop((time) => {
      if (bassSynth) {
        const chordIndex = bassStep % BASS_ROOTS.length;
        const rootNote = BASS_ROOTS[chordIndex];
        bassSynth.triggerAttackRelease(rootNote, '4n', time);
      }
      bassStep++;
    }, '4n');

    // Kick loop
    let kickStep = 0;
    kickLoop = new Tone.Loop((time) => {
      if (kickSynth && kickPattern[kickStep % 16]) {
        // Add occasional variation on step 11
        if (kickStep % 16 === 10 && Math.random() < 0.3) {
          kickSynth.triggerAttackRelease('C1', '8n', time);
        } else if (kickPattern[kickStep % 16]) {
          kickSynth.triggerAttackRelease('C1', '8n', time);
        }
        
        // Sidechain ducking: duck chords/pad when kick hits
        if (chordsBus) {
          const currentGain = chordsBus.gain.value;
          // Duck down to ~0.8 linear gain
          chordsBus.gain.rampTo(currentGain * 0.8, 0.01, time);
          // Return to original level over ~110ms
          chordsBus.gain.rampTo(currentGain, 0.11, time + 0.01);
        }
      }
      kickStep++;
    }, '16n');

    // Snare loop
    let snareStep = 0;
    snareLoop = new Tone.Loop((time) => {
      if (snareSynth && snarePattern[snareStep % 16]) {
        snareSynth.triggerAttackRelease('8n', time);
      }
      snareStep++;
    }, '16n');

    // Hats loop
    let hatsStep = 0;
    hatsLoop = new Tone.Loop((time) => {
      if (hatsSynth && hatPattern[hatsStep % 16]) {
        // 20% chance of rest
        if (Math.random() > 0.2) {
          hatsSynth.triggerAttackRelease('16n', time);
        }
      }
      hatsStep++;
    }, '16n');

    // Start all loops at time 0, but muted
    leadLoop.start(0);
    chordsLoop.start(0);
    bassLoop.start(0);
    kickLoop.start(0);
    snareLoop.start(0);
    hatsLoop.start(0);

    // Mute all initially
    leadLoop.mute = true;
    chordsLoop.mute = true;
    bassLoop.mute = true;
    kickLoop.mute = true;
    snareLoop.mute = true;
    hatsLoop.mute = true;

    isInitialized = true;
    console.log('Instruments initialized with improved sound');
    console.log('Pad toned');

  } catch (error) {
    console.error('Failed to initialize instruments:', error);
  }
}

// Individual part toggles
export function setLead(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (leadLoop) leadLoop.mute = !on;
  setIndividualLayer('lead', on);
  console.log(`Lead ${on ? 'enabled' : 'disabled'}`);
}

export function setChords(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (chordsLoop) chordsLoop.mute = !on;
  setIndividualLayer('chords', on);
  console.log(`Chords ${on ? 'enabled' : 'disabled'}`);
}

export function setBass(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (bassLoop) bassLoop.mute = !on;
  setIndividualLayer('bass', on);
  console.log(`Bass ${on ? 'enabled' : 'disabled'}`);
}

export function setKick(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (kickLoop) kickLoop.mute = !on;
  setIndividualLayer('kick', on);
  console.log(`Kick ${on ? 'enabled' : 'disabled'}`);
}

export function setSnare(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (snareLoop) snareLoop.mute = !on;
  setIndividualLayer('snare', on);
  console.log(`Snare ${on ? 'enabled' : 'disabled'}`);
}

export function setHats(on: boolean): void {
  if (!isInitialized || typeof window === 'undefined') {
    console.warn('Instruments not initialized');
    return;
  }
  if (hatsLoop) hatsLoop.mute = !on;
  setIndividualLayer('hats', on);
  console.log(`Hats ${on ? 'enabled' : 'disabled'}`);
}

// Backward compatibility wrappers
export function toggleDrums(on: boolean): void {
  setKick(on);
  setSnare(on);
  setHats(on);
}

export function toggleMelody(on: boolean): void {
  setLead(on);
  setChords(on);
}

// Safe dev helpers (browser only)
if (typeof window !== 'undefined') {
  // Quick beep to verify audio output works at all
  (window as any).__mmBeep = async () => {
    await Tone.start();
    new Tone.Synth().toDestination().triggerAttackRelease("A4", "8n");
  };

  // Bus mixer control - corrected units
  (window as any).__mmBus = (v: {lead?: number; chords?: number; bass?: number; kick?: number; snare?: number; hats?: number; master?: number} = {}) => {
    if (v.lead !== undefined && leadBus) leadBus.gain.value = v.lead; // linear gain
    if (v.chords !== undefined && chordsBus) chordsBus.gain.value = v.chords; // linear gain
    if (v.bass !== undefined && bassBus) bassBus.gain.value = v.bass; // linear gain
    if (v.kick !== undefined && kickBus) kickBus.gain.value = v.kick; // linear gain
    if (v.snare !== undefined && snareBus) snareBus.gain.value = v.snare; // linear gain
    if (v.hats !== undefined && hatsBus) hatsBus.gain.value = v.hats; // linear gain
    if (v.master !== undefined) Tone.Destination.volume.value = v.master; // dB
    return { 
      lead: leadBus?.gain.value ?? null, 
      chords: chordsBus?.gain.value ?? null, 
      bass: bassBus?.gain.value ?? null,
      kick: kickBus?.gain.value ?? null,
      snare: snareBus?.gain.value ?? null,
      hats: hatsBus?.gain.value ?? null,
      master: Tone.Destination.volume.value 
    };
  };

  // Metronome toggle
  (window as any).__mmMetro = (on: boolean = true) => {
    if (on) {
      if (!__metro) {
        const click = new Tone.MembraneSynth().connect(kickBus!);
        __metro = new Tone.Loop((t) => click.triggerAttackRelease("C2", "16n", t), "4n").start(0);
      }
      Tone.Transport.start();
    } else {
      __metro?.stop(0);
      __metro = null;
    }
    return { state: Tone.Transport.state, bpm: Tone.Transport.bpm.value };
  };

  // Audio status inspector
  (window as any).__mmAudioStatus = () => ({
    transport: Tone.Transport.state,
    bpm: Tone.Transport.bpm.value,
    masterMuted: Tone.Destination.mute,
    masterVol: Tone.Destination.volume.value,
    swing: Tone.Transport.swing,
    swingSubdivision: Tone.Transport.swingSubdivision
  });

  // Set proper volume levels for clear audio
  (window as any).__mmBus?.({ master: 0, lead: 0.8, chords: 0.7, bass: 0.9, kick: 1.0, snare: 0.8, hats: 0.8 });
}