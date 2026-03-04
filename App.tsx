import { useEffect, useRef, useState } from 'react';

// --- Constants & Types ---
const GAME_SPEED = 0.8;
const GRAVITY = 0.45;
const JUMP_FORCE = -12;
const WALK_SPEED = 2.4;
const MAX_HEALTH = 16000; // Increased by 4x as requested

type GameState = 'menu' | 'playing' | 'fatality';
type FinisherType = 'FATALITY' | 'BRUTALITY' | 'FRIENDSHIP' | 'BABALITY' | 'ANIMALITY';
type GameMode = 'ai' | 'pvp';

interface Controls {
  left: string;
  right: string;
  jump: string;
  block: string;
  punch: string;
  kick: string;
  super1: string;
  super2: string;
}

const DEFAULT_P1_CONTROLS: Controls = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'KeyW',
  block: 'KeyS',
  punch: 'Space',
  kick: 'KeyE',
  super1: 'KeyQ',
  super2: 'KeyF'
};

const DEFAULT_P2_CONTROLS: Controls = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  block: 'ArrowDown',
  punch: 'KeyK',
  kick: 'KeyL',
  super1: 'KeyJ',
  super2: 'KeyH'
};

const ANIM_STATES = {
  idle: { sF: -70, eF: -80, sB: 30, eB: -90, hF: -20, kF: 20, hB: 20, kB: 10, torso: 5 },
  block: { sF: -130, eF: -120, sB: -100, eB: -120, hF: -20, kF: 30, hB: 30, kB: 20, torso: 15 },
  punch1: { sF: -90, eF: 0, sB: 60, eB: -90, hF: -30, kF: 20, hB: 40, kB: 10, torso: 20 },
  punch2: { sF: -130, eF: -40, sB: 80, eB: -90, hF: -20, kF: 20, hB: 30, kB: 20, torso: -10 },
  kick1: { sF: -45, eF: -90, sB: 45, eB: -90, hF: -90, kF: 0, hB: 10, kB: 20, torso: -20 },
  kick2: { sF: 0, eF: -90, sB: 0, eB: -90, hF: -130, kF: -20, hB: 30, kB: 30, torso: -40 },
  airPunch: { sF: -90, eF: 0, sB: 60, eB: -90, hF: -50, kF: 90, hB: 10, kB: 60, torso: 15 },
  airKick: { sF: -20, eF: -50, sB: 40, eB: -90, hF: -40, kF: -10, hB: -60, kB: 10, torso: -10 },
  hit: { sF: -40, eF: -20, sB: 0, eB: -20, hF: -10, kF: 10, hB: 10, kB: 10, torso: 15 },
  superCharge: { sF: -150, eF: -50, sB: 80, eB: -130, hF: -40, kF: 60, hB: 30, kB: 50, torso: -30 },
  superFire: { sF: -90, eF: 0, sB: -80, eB: 0, hF: -20, kF: 10, hB: 50, kB: 10, torso: 30 },
  superSlash: { sF: -160, eF: -20, sB: -160, eB: -20, hF: -60, kF: 20, hB: 40, kB: 30, torso: 40 },
  dead: { sF: -20, eF: -10, sB: -20, eB: -10, hF: 90, kF: 90, hB: 90, kB: 90, torso: 80 },
  win: { sF: -160, eF: -80, sB: -160, eB: -80, hF: -20, kF: 20, hB: 20, kB: 10, torso: -10 },
  baby: { sF: -40, eF: -90, sB: 40, eB: -90, hF: 40, kF: 90, hB: -40, kB: 90, torso: 0 },
  dance: { sF: 180, eF: 180, sB: 180, eB: 180, hF: 30, kF: 30, hB: -30, kB: 30, torso: 10 },
};

const FINISHER_COMBOS: Record<string, FinisherType> = {
  'DOWN,DOWN,PUNCH': 'FATALITY',
  'RIGHT,DOWN,KICK': 'BRUTALITY',
  'UP,UP,KICK': 'FRIENDSHIP',
  'DOWN,UP,PUNCH': 'BABALITY',
  'RIGHT,RIGHT,PUNCH': 'ANIMALITY',
};

// --- Helper Functions ---
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; life: number; maxLife: number;
  size: number; isNeon: boolean; text: string | null;

  constructor(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, isNeon = false, text: string | null = null) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
    this.size = size; this.isNeon = isNeon; this.text = text;
  }

  update() {
    this.x += this.vx * GAME_SPEED;
    this.y += this.vy * GAME_SPEED;
    if (!this.isNeon && !this.text) this.vy += GRAVITY * GAME_SPEED;
    this.life -= 1 * GAME_SPEED;
  }

  draw(ctx: CanvasRenderingContext2D) {
    let alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    if (this.text) {
      ctx.font = '900 24px "Rajdhani", sans-serif';
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.fillText(this.text, this.x, this.y);
      ctx.shadowBlur = 0;
    } else {
      if (this.isNeon) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.globalCompositeOperation = 'lighter';
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

// --- Sound Engine ---
let audioCtx: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let activeAudioElements: HTMLAudioElement[] = [];

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const playSound = (type: 'swing' | 'hit' | 'block' | 'crit' | 'beam' | 'blackhole' | 'slash' | 'explosion' | 'charge' | 'finish_him' | 'fatality' | 'brutality' | 'friendship' | 'babality' | 'animality') => {
  const audioCtx = getAudioContext();
  
  const finisherSounds = ['finish_him', 'fatality', 'brutality', 'friendship', 'babality', 'animality'];
  if (finisherSounds.includes(type)) {
    const urls = {
      'finish_him': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772663415482-tm2j701a.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjYzNDE1NDgyLXRtMmo3MDFhLm1wMyIsImlhdCI6MTc3MjY2MzUxMiwiZXhwIjoxNzcyNjY3MTEyfQ.G0wHLwztarrq-Gd01AxGOHp2i1gVBRYM9XbyYc4Tks0',
      'fatality': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772663845879-l6fcmkue.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjYzODQ1ODc5LWw2ZmNta3VlLm1wMyIsImlhdCI6MTc3MjY2Mzg1NCwiZXhwIjoxNzcyNjY3NDU0fQ.czsPMS6ofWL9lyyd2UVO41TEH2BH_tCXLZn7f4ltrzc',
      'brutality': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772663345161-8gcdzcdj.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjYzMzQ1MTYxLThnY2R6Y2RqLm1wMyIsImlhdCI6MTc3MjY2MzczMiwiZXhwIjoxNzcyNjY3MzMyfQ.ORvXoAXl15FkVhzllBgRAkfgr17SiKTa280QfmlvWno',
      'friendship': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772663936623-woy4wnh2.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjYzOTM2NjIzLXdveTR3bmgyLm1wMyIsImlhdCI6MTc3MjY2Mzk3MCwiZXhwIjoxNzcyNjY3NTcwfQ.f9P4KJf_cXHXWW4FG8bW15BPH81gtzmK-g-WRLOputI',
      'babality': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772664071227-golcygq2.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjY0MDcxMjI3LWdvbGN5Z3EyLm1wMyIsImlhdCI6MTc3MjY2NDA3OCwiZXhwIjoxNzcyNjY3Njc4fQ.U5tJXtKsfnQ3a5XUAYnsrCt1ohvG-hrVFtHhwXFRjJw',
      'animality': 'https://gnygxghbaxatvpryczjc.supabase.co/storage/v1/object/sign/files/1772664313679-ukjirsfk.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNTg5ZDg2ZS00MTZlLTRkMzItOGYxZS03OGJmMGZhMDA1MTMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJmaWxlcy8xNzcyNjY0MzEzNjc5LXVramlyc2ZrLm1wMyIsImlhdCI6MTc3MjY2NDMyMSwiZXhwIjoxNzcyNjY3OTIxfQ.MHH8hr8GzWAf4LlKSUVMa9q7LqyjzLzJ5Fdd3bpX29U'
    };
    try {
      const audio = new Audio((urls as any)[type]);
      audio.crossOrigin = '';
      activeAudioElements.push(audio);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn("Sound play error:", type, e);
          activeAudioElements = activeAudioElements.filter(a => a !== audio);
        });
      }
      
      audio.onended = () => {
        activeAudioElements = activeAudioElements.filter(a => a !== audio);
      };
      
      // Cleanup old audio elements to prevent memory leak
      if (activeAudioElements.length > 10) {
        const old = activeAudioElements.shift();
        if (old) old.pause();
      }
    } catch (e) {
      console.warn("Failed to create audio:", type, e);
    }
    return;
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  activeOscillators.push(osc);
  if (activeOscillators.length > 32) {
    const removed = activeOscillators.shift();
    try { removed?.stop(); } catch (e) {}
  }
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  const stopTime = (type === 'beam') ? now + 1.5 : (type === 'blackhole') ? now + 2.0 : (type === 'charge') ? now + 0.5 : (type === 'crit') ? now + 0.3 : (type === 'swing' || type === 'hit') ? now + 0.1 : now + 0.05;
  
  osc.addEventListener('ended', () => {
    activeOscillators = activeOscillators.filter(o => o !== osc);
  });

  if (type === 'swing') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'block') {
    osc.type = 'square'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05); osc.start(now); osc.stop(now + 0.05);
  } else if (type === 'crit') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'charge') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(1000, now + 0.5);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.5, now + 0.1); gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now); osc.stop(now + 0.5);
  } else if (type === 'beam') {
    const noise = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    activeOscillators.push(noise, lfo);
    
    noise.type = 'square'; noise.frequency.setValueAtTime(60, now);
    lfo.frequency.setValueAtTime(30, now);
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(40, now);
    lfo.connect(lfoGain); lfoGain.connect(noise.frequency);
    noise.connect(gain);
    gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    lfo.start(now); noise.start(now); lfo.stop(now + 1.5); noise.stop(now + 1.5);
    
    noise.addEventListener('ended', () => {
      activeOscillators = activeOscillators.filter(o => o !== noise);
    });
    lfo.addEventListener('ended', () => {
      activeOscillators = activeOscillators.filter(o => o !== lfo);
    });
  } else if (type === 'blackhole') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(40, now); osc.frequency.exponentialRampToValueAtTime(400, now + 2.0);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.6, now + 0.5); gain.gain.linearRampToValueAtTime(0, now + 2.0);
    osc.start(now); osc.stop(now + 2.0);
  } else if (type === 'slash') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15); osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'explosion') {
    osc.type = 'triangle'; osc.frequency.setValueAtTime(60, now); osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
    gain.gain.setValueAtTime(1.0, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0); osc.start(now); osc.stop(now + 1.0);
  } else if (type === 'finish_him') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
    gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5); osc.start(now); osc.stop(now + 1.5);
  }
};

class Fighter {
  x: number; y: number; isAI: boolean; isP1: boolean;
  width = 40; height = 120;
  color: string; bodyColor: string; superColor1: string; superColor2: string;
  controls: Controls;
  superType1: string; superType2: string;
  health = MAX_HEALTH; maxHealth = MAX_HEALTH;
  superMeter1 = 0; superMeter2 = 0;
  velocity = { x: 0, y: 0 };
  speed = WALK_SPEED;
  facingRight: boolean;
  state: keyof typeof ANIM_STATES = 'idle';
  attackTimer = 0;
  isBlocking = false;
  stunTimer = 0;
  comboCounter = 0;
  comboTimer = 0;
  superCasting = false;
  activeSuper: string | null = null;
  superTimer = 0;
  isLevitating = false;
  angles: any;

  inputBuffer: string[] = [];
  inputBufferTimer = 0;

  constructor(x: number, y: number, isAI: boolean, isP1: boolean, controls: Controls, superType1: string, superType2: string) {
    this.x = x; this.y = y; this.isAI = isAI; this.isP1 = isP1;
    this.controls = controls;
    this.superType1 = superType1; this.superType2 = superType2;
    this.facingRight = isP1;
    this.color = '#111';
    this.bodyColor = '#151515';
    this.superColor1 = '#f1c40f';
    this.superColor2 = isP1 ? '#00d2ff' : '#ff0055';
    this.angles = { ...ANIM_STATES.idle };
  }

  handleInput(code: string) {
    let input = '';
    if (code === this.controls.jump) input = 'UP';
    else if (code === this.controls.block) input = 'DOWN';
    else if (code === this.controls.left) input = 'LEFT';
    else if (code === this.controls.right) input = 'RIGHT';
    else if (code === this.controls.punch) input = 'PUNCH';
    else if (code === this.controls.kick) input = 'KICK';

    if (input) {
      this.inputBuffer.push(input);
      this.inputBufferTimer = 60;
      if (this.inputBuffer.length > 5) this.inputBuffer.shift();
    }
  }

  update(opponent: Fighter, keys: Record<string, boolean>, gameState: GameState, time: number, particles: Particle[], checkDeath: () => void, updateUI: () => void, spawnHitParticles: (x: number, y: number, isBlock: boolean, color?: string) => void, screenShake: (amt: number) => void, finisherType?: FinisherType) {
    if (this.inputBufferTimer > 0) {
      this.inputBufferTimer -= 1 * GAME_SPEED;
      if (this.inputBufferTimer <= 0) this.inputBuffer = [];
    }

    if (gameState === 'fatality') {
      const isWinner = opponent.health <= 0;
      let targetAngles = this.health <= 0 ? { ...ANIM_STATES.dead } : { ...ANIM_STATES.win };

      if (isWinner && !finisherType) {
        if (this.isAI) {
          if (Math.random() < 0.01) {
            const finishers: FinisherType[] = ['FATALITY', 'BRUTALITY', 'FRIENDSHIP', 'BABALITY', 'ANIMALITY'];
            (window as any).triggerFinisher(finishers[Math.floor(Math.random() * finishers.length)]);
          }
        } else {
          const comboStr = this.inputBuffer.join(',');
          for (const [seq, type] of Object.entries(FINISHER_COMBOS)) {
            if (comboStr.includes(seq)) {
              (window as any).triggerFinisher(type);
              this.inputBuffer = [];
              break;
            }
          }
        }
      }

      if (!this.isLevitating) this.y += 2 * GAME_SPEED;
      if (this.y >= 380) this.y = 380;
      
      if (finisherType === 'BABALITY' && this.health <= 0) {
        targetAngles = { ...ANIM_STATES.baby };
      }

      if (finisherType === 'FRIENDSHIP' && this.health > 0) {
        targetAngles = { ...ANIM_STATES.dance };
        if (Math.floor(time * 0.1) % 2 === 0) targetAngles.torso = 20;
        else targetAngles.torso = -20;
      }

      // Finisher sequence for the winner
      if (this.health > 0) {
        if (finisherType === 'FATALITY' || finisherType === 'BRUTALITY') {
          if (Math.abs(this.x - opponent.x) < 150) {
            let fatTime = Math.floor(time * 0.2) % 10;
            let isBrutality = finisherType === 'BRUTALITY';
            if (isBrutality) fatTime = Math.floor(time * 0.5) % 10;

            if (fatTime < 5) {
              targetAngles = { ...ANIM_STATES.punch1 };
              if (time % (isBrutality ? 5 : 15) < 1) { 
                playSound('hit'); screenShake(isBrutality ? 15 : 10); 
                spawnHitParticles(opponent.x, opponent.y - 50, false, '#ff0000'); 
              }
            } else {
              targetAngles = { ...ANIM_STATES.kick2 };
              if (time % (isBrutality ? 5 : 15) < 1) { 
                playSound('crit'); screenShake(isBrutality ? 25 : 20); 
                spawnHitParticles(opponent.x, opponent.y - 50, false, '#ff0000'); 
              }
            }

            if (isBrutality && time % 60 < 1) {
              playSound('explosion');
              for (let i = 0; i < 20; i++) particles.push(new Particle(opponent.x, opponent.y - 50, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, '#ff0000', 40, 5, true));
            }
          }
        } else if (finisherType === 'ANIMALITY') {
          if (Math.abs(this.x - opponent.x) < 150) {
            targetAngles = { ...ANIM_STATES.superCharge };
            if (time % 30 < 1) {
              playSound('blackhole');
              for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y - 50, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, '#00ff00', 60, 8, true));
              spawnHitParticles(opponent.x, opponent.y - 50, false, '#ff0000');
            }
          }
        }
      }

      if (this.health <= 0 && finisherType !== 'BABALITY' && finisherType !== 'FRIENDSHIP' && Math.random() < 0.3) {
        particles.push(new Particle(this.x + (Math.random() - 0.5) * 50, this.y - Math.random() * 100, (Math.random() - 0.5) * 2, -Math.random() * 3, this.color, 40, 3, false));
      }
      
      let lerpS = finisherType === 'BRUTALITY' ? 0.2 : 0.05;
      for (let key in this.angles) this.angles[key] = lerp(this.angles[key], (targetAngles as any)[key], lerpS);
      return;
    }

    if (!this.isLevitating) this.velocity.y += GRAVITY * GAME_SPEED;
    this.y += this.velocity.y * GAME_SPEED;
    this.x += this.velocity.x * GAME_SPEED;

    let floorY = 380;
    if (this.y >= floorY && !this.isLevitating) {
      this.y = floorY; this.velocity.y = 0;
    }

    if (this.x <= 20) this.x = 20;
    if (this.x >= 900 - 20) this.x = 900 - 20;

    if (!this.superCasting && this.stunTimer <= 0) {
      this.facingRight = this.x < opponent.x;
    }

    if (this.comboTimer > 0) this.comboTimer -= 1 * GAME_SPEED;
    if (this.superMeter2 < 100 && !this.superCasting) this.superMeter2 += 0.04 * GAME_SPEED;

    let targetAngles = { ...ANIM_STATES.idle };

    if (this.superCasting) {
      this.handleSuper(opponent, targetAngles, checkDeath, updateUI, spawnHitParticles, screenShake, particles);
    } else {
      this.handleNormalActions(opponent, targetAngles, keys, particles, checkDeath, updateUI, spawnHitParticles, screenShake);
    }

    if (this.state === 'idle' && this.velocity.y === 0 && this.stunTimer <= 0) {
      if (Math.abs(this.velocity.x) > 0.5) {
        let walkCycle = time * 0.15;
        targetAngles.hF = Math.sin(walkCycle) * 40;
        targetAngles.kF = 20 + Math.abs(Math.cos(walkCycle)) * 40;
        targetAngles.hB = Math.sin(walkCycle + Math.PI) * 40;
        targetAngles.kB = 20 + Math.abs(Math.cos(walkCycle + Math.PI)) * 40;
        targetAngles.torso = 10;
        targetAngles.sF = -70 + Math.sin(walkCycle) * 30;
        targetAngles.sB = 30 + Math.sin(walkCycle + Math.PI) * 30;
      } else {
        targetAngles.torso += Math.sin(time * 0.05) * 3;
        targetAngles.sF += Math.sin(time * 0.05) * 4;
      }
    }

    if (this.y < floorY && this.state === 'idle' && !this.isLevitating) {
      targetAngles.hF = -20; targetAngles.kF = 70;
      targetAngles.hB = 20; targetAngles.kB = 70;
    }

    let lerpSpeed = (this.state === 'idle' ? 0.15 : 0.3) * GAME_SPEED;
    for (let key in this.angles) this.angles[key] = lerp(this.angles[key], (targetAngles as any)[key], lerpSpeed);
  }

  handleNormalActions(opponent: Fighter, targetAngles: any, keys: Record<string, boolean>, particles: Particle[], checkDeath: () => void, updateUI: () => void, spawnHitParticles: (x: number, y: number, isBlock: boolean, color?: string) => void, screenShake: (amt: number) => void) {
    if (this.stunTimer > 0) {
      this.stunTimer -= 1 * GAME_SPEED;
      this.velocity.x = 0; this.velocity.y = 0;
      this.isLevitating = true; this.isBlocking = false;
      Object.assign(targetAngles, ANIM_STATES.hit);
      return;
    } else this.isLevitating = false;

    this.velocity.x *= 0.8;
    this.isBlocking = false;

    if (this.attackTimer > 0) {
      this.attackTimer -= 1 * GAME_SPEED;
      Object.assign(targetAngles, ANIM_STATES[this.state]);
      if (this.attackTimer <= 0) this.state = 'idle';
      return;
    }

    let onGround = this.y >= 380;

    if (!this.isAI) {
      this.isBlocking = keys[this.controls.block] && onGround;
      if (this.isBlocking) {
        Object.assign(targetAngles, ANIM_STATES.block);
        targetAngles.torso += 10;
      } else {
        if (keys[this.controls.left]) this.velocity.x = -this.speed;
        if (keys[this.controls.right]) this.velocity.x = this.speed;
        if (keys[this.controls.jump] && onGround) this.velocity.y = JUMP_FORCE;

        if (keys[this.controls.punch]) this.triggerAttack('punch', opponent, onGround, checkDeath, updateUI, spawnHitParticles, screenShake, particles);
        else if (keys[this.controls.kick]) this.triggerAttack('kick', opponent, onGround, checkDeath, updateUI, spawnHitParticles, screenShake, particles);
        else if (keys[this.controls.super1] && this.superMeter1 >= 100) this.triggerSuper(this.superType1, 1, updateUI, screenShake, particles);
        else if (keys[this.controls.super2] && this.superMeter2 >= 100) this.triggerSuper(this.superType2, 2, updateUI, screenShake, particles);
      }
    } else {
      const dist = Math.abs(this.x - opponent.x);
      if (this.superMeter1 >= 100 && Math.random() < 0.03) this.triggerSuper(this.superType1, 1, updateUI, screenShake, particles);
      else if (this.superMeter2 >= 100 && Math.random() < 0.02) this.triggerSuper(this.superType2, 2, updateUI, screenShake, particles);
      else if (dist > 100) {
        this.velocity.x = this.x < opponent.x ? this.speed * 0.8 : -this.speed * 0.8;
      } else if (Math.random() < 0.04) {
        this.triggerAttack(Math.random() > 0.4 ? 'punch' : 'kick', opponent, onGround, checkDeath, updateUI, spawnHitParticles, screenShake, particles);
      } else if (opponent.state !== 'idle' && Math.random() < 0.4 && onGround) {
        this.isBlocking = true; Object.assign(targetAngles, ANIM_STATES.block);
      }
    }
  }

  triggerAttack(baseType: 'punch' | 'kick', opponent: Fighter, onGround: boolean, checkDeath: () => void, updateUI: () => void, spawnHitParticles: (x: number, y: number, isBlock: boolean, color?: string) => void, screenShake: (amt: number) => void, particles: Particle[]) {
    playSound('swing');
    if (this.comboTimer <= 0) this.comboCounter = 0;
    this.comboCounter++; this.comboTimer = 100;

    let isFinisher = this.comboCounter >= 3;
    if (!onGround) {
      this.state = baseType === 'punch' ? 'airPunch' : 'airKick';
    } else {
      this.state = isFinisher ? (baseType + '2' as any) : (baseType + '1' as any);
    }

    if (isFinisher) this.comboCounter = 0;
    this.attackTimer = baseType === 'punch' ? 24 : 35;

    let reach = baseType === 'punch' ? 75 : 100;
    let baseDamage = baseType === 'punch' ? 160 : 280; // Scaled for 16k HP
    if (isFinisher) baseDamage *= 1.3;
    if (!onGround) baseDamage *= 0.8;

    let attackX = this.x + (this.facingRight ? reach : -reach);

    setTimeout(() => {
      if (this.attackTimer <= 0) return;

      if (Math.abs(attackX - opponent.x) < 50 && Math.abs(this.y - opponent.y) < 80) {
        let isCrit = Math.random() < 0.2 && !opponent.isBlocking;
        let finalDamage = isCrit ? baseDamage * 2 : baseDamage;
        let dmgDealt = opponent.isBlocking ? finalDamage * 0.3 : finalDamage;

        opponent.health -= dmgDealt;
        if (opponent.superMeter2 < 100) opponent.superMeter2 += (dmgDealt / MAX_HEALTH) * 100 * 0.5;
        if (this.superMeter1 < 100) this.superMeter1 += 5;

        if (isCrit) {
          playSound('crit');
          particles.push(new Particle(opponent.x, opponent.y - 80, 0, -2, '#bc13fe', 40, 0, true, "CRIT!"));
          spawnHitParticles(attackX, opponent.y - 30, false, '#bc13fe');
          screenShake(this.isP1 ? 25 : 15);
          if (this.isP1) {
            for (let i = 0; i < 15; i++) {
              particles.push(new Particle(attackX, opponent.y - 30, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, '#00d2ff', 30, 4, true));
            }
          }
        } else {
          playSound(opponent.isBlocking ? 'block' : 'hit');
          spawnHitParticles(attackX, opponent.y - 30, opponent.isBlocking, opponent.isBlocking ? '#00d2ff' : this.superColor2);
          if (this.isP1 && !opponent.isBlocking) screenShake(12);
        }

        if (!opponent.isBlocking) {
          opponent.velocity.x = this.facingRight ? (isCrit ? 10 : 6) : (isCrit ? -10 : -6);
          if (baseType === 'kick' || !onGround) opponent.velocity.y = -5;
          if (!isCrit) screenShake(baseType === 'kick' ? 8 : 4);
        }

        checkDeath(); updateUI();
      }
    }, onGround ? 150 : 100);
  }

  triggerSuper(type: string, meterIndex: number, updateUI: () => void, screenShake: (amt: number) => void, particles: Particle[]) {
    if (meterIndex === 1) this.superMeter1 = 0; else this.superMeter2 = 0;
    this.superCasting = true; this.activeSuper = type; this.velocity.x = 0; this.velocity.y = 0;
    playSound('charge');
    screenShake(40);

    // Visual indicator for super
    const superName = type.toUpperCase() + "!";
    const color = meterIndex === 1 ? this.superColor1 : this.superColor2;
    particles.push(new Particle(this.x, this.y - 150, 0, -1, color, 60, 0, true, superName));

    if (type === 'beam') this.superTimer = 180;
    else if (type === 'triSlash') this.superTimer = 210;
    else if (type === 'omnislash') this.superTimer = 225;
    else if (type === 'blackhole') this.superTimer = 270;

    updateUI();
  }

  handleSuper(opponent: Fighter, targetAngles: any, checkDeath: () => void, updateUI: () => void, spawnHitParticles: (x: number, y: number, isBlock: boolean, color?: string) => void, screenShake: (amt: number) => void, particles: Particle[]) {
    this.superTimer -= 1 * GAME_SPEED;
    const type = this.activeSuper;

    if (type === 'beam') {
      if (this.superTimer > 120) {
        Object.assign(targetAngles, ANIM_STATES.superCharge);
        this.y -= 0.5 * GAME_SPEED; screenShake(3);
        // Charging particles
        for (let i = 0; i < 3; i++) {
          particles.push(new Particle(this.x + (Math.random() - 0.5) * 400, this.y - 60 + (Math.random() - 0.5) * 400, (this.x - (this.x + (Math.random() - 0.5) * 400)) * 0.1, (this.y - 60 - (this.y - 60 + (Math.random() - 0.5) * 400)) * 0.1, this.superColor1, 15, 4, true));
        }
      } else if (this.superTimer > 0) {
        if (Math.abs(this.superTimer - 120) < 2) { 
          screenShake(50); playSound('beam'); 
          // Initial blast wave
          for (let i = 0; i < 30; i++) {
            particles.push(new Particle(this.x, this.y - 60, (this.facingRight ? 1 : -1) * (10 + Math.random() * 20), (Math.random() - 0.5) * 10, '#fff', 20, 5, true));
          }
        }
        Object.assign(targetAngles, ANIM_STATES.superFire); screenShake(15);
        // Recoil
        this.x -= (this.facingRight ? 1 : -1) * 0.5 * GAME_SPEED;
        
        if ((this.facingRight && opponent.x > this.x) || (!this.facingRight && opponent.x < this.x)) {
          if (Math.floor(this.superTimer) % 4 === 0) {
            opponent.health -= opponent.isBlocking ? 100 : 220;
            opponent.velocity.x = this.facingRight ? 12 : -12;
            spawnHitParticles(opponent.x + opponent.width / 2, opponent.y - 40, false, this.superColor1);
            checkDeath(); updateUI();
          }
        }
        // Beam flares
        if (Math.random() < 0.5) {
          particles.push(new Particle(this.x + (this.facingRight ? 50 : -50), this.y - 60, (this.facingRight ? 1 : -1) * 30, (Math.random() - 0.5) * 15, '#fff', 10, 2, true));
        }
      } else { this.superCasting = false; this.state = 'idle'; }
    } else if (type === 'triSlash') {
      opponent.stunTimer = 15; opponent.isLevitating = true; opponent.velocity.x = 0; opponent.velocity.y = 0;
      if (this.superTimer > 165) {
        Object.assign(targetAngles, ANIM_STATES.superCharge); screenShake(5);
        particles.push(new Particle(this.x + (Math.random() - 0.5) * 200, this.y - 60 + (Math.random() - 0.5) * 200, 0, -10, '#ff0000', 25, 5, true));
      } else if (this.superTimer > 0) {
        this.isLevitating = true; this.velocity.y = 0; this.velocity.x = 0;
        Object.assign(targetAngles, ANIM_STATES.superSlash);
        let t = Math.floor(this.superTimer);
        if (t === 165 || t === 112 || t === 60) {
          screenShake(45);
          playSound('slash');
          // Impact flash particle
          particles.push(new Particle(opponent.x, opponent.y - 50, 0, 0, '#fff', 5, 500, true));
          
          if (t === 165) { 
            this.x = opponent.x; this.y = opponent.y - 180; 
            opponent.health -= opponent.isBlocking ? 200 : 450; 
            spawnHitParticles(opponent.x, opponent.y - 50, false, '#ff0055');
          }
          if (t === 112) { 
            this.x = opponent.x - 150; this.y = opponent.y; this.facingRight = true; 
            opponent.health -= opponent.isBlocking ? 200 : 450; 
            spawnHitParticles(opponent.x - 30, opponent.y - 40, false, '#ff0055');
          }
          if (t === 60) {
            this.x = opponent.x + 150; this.y = opponent.y; this.facingRight = false; 
            opponent.health -= opponent.isBlocking ? 400 : 1000; 
            playSound('explosion');
            screenShake(70);
            for (let i = 0; i < 80; i++) particles.push(new Particle(opponent.x, opponent.y - 50, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, '#ff0055', 70, 10, true));
            spawnHitParticles(opponent.x + 30, opponent.y - 40, false, '#ff0055');
          }
          checkDeath(); updateUI();
        }
      } else {
        this.superCasting = false; this.isLevitating = false; opponent.isLevitating = false; this.state = 'idle'; this.y = 380; checkDeath(); updateUI();
      }
    } else if (type === 'omnislash') {
      if (this.superTimer > 195) {
        Object.assign(targetAngles, ANIM_STATES.superCharge); screenShake(5);
        particles.push(new Particle(this.x + (Math.random() - 0.5) * 100, this.y - 60, (Math.random() - 0.5) * 5, -15, this.superColor2, 20, 4, true));
      } else if (this.superTimer > 45) {
        this.isLevitating = true; Object.assign(targetAngles, ANIM_STATES.punch2);
        opponent.velocity.x = 0; opponent.velocity.y = 0; opponent.isLevitating = true;
        if (Math.floor(this.superTimer) % 12 === 0) {
          screenShake(20);
          let angle = Math.random() * Math.PI * 2; let dist = 80 + Math.random() * 60;
          this.x = opponent.x + Math.cos(angle) * dist; this.y = opponent.y - 50 + Math.sin(angle) * dist;
          this.facingRight = this.x < opponent.x;
          opponent.health -= opponent.isBlocking ? 40 : 80;
          spawnHitParticles(opponent.x, opponent.y - 40, false, this.superColor2);
          // Afterimage
          particles.push(new Particle(this.x, this.y - 50, 0, 0, this.superColor2, 10, 30, true));
          checkDeath(); updateUI();
        }
      } else if (this.superTimer > 0) {
        if (Math.abs(this.superTimer - 45) < 2) { 
          this.x = opponent.x; this.y = opponent.y - 250; this.velocity.y = 35; 
          // Sonic boom ring
          for (let i = 0; i < 360; i += 10) {
            let r = i * Math.PI / 180;
            particles.push(new Particle(this.x, this.y, Math.cos(r) * 15, Math.sin(r) * 15, '#fff', 15, 3, true));
          }
        }
        Object.assign(targetAngles, ANIM_STATES.kick2);
        if (this.y >= 380) {
          this.y = 380; this.velocity.y = 0; if (this.superTimer > 5) this.superTimer = 5;
          screenShake(80); opponent.isLevitating = false;
          opponent.health -= opponent.isBlocking ? 400 : 900;
          opponent.velocity.y = -18; opponent.velocity.x = this.facingRight ? 25 : -25;
          playSound('explosion');
          // Ground impact debris
          for (let i = 0; i < 100; i++) {
            particles.push(new Particle(this.x, 380, (Math.random() - 0.5) * 40, -Math.random() * 30, '#555', 50, Math.random() * 6 + 2));
            particles.push(new Particle(this.x, 380, (Math.random() - 0.5) * 50, -Math.random() * 20, this.superColor2, 40, 4, true));
          }
          spawnHitParticles(opponent.x, opponent.y, false, this.superColor2);
          checkDeath(); updateUI();
        }
      } else { this.isLevitating = false; this.superCasting = false; this.state = 'idle'; this.y = 380; }
    } else if (type === 'blackhole') {
      let cx = 900 / 2; let cy = 450 / 2 - 50;
      if (this.superTimer > 225) {
        Object.assign(targetAngles, ANIM_STATES.win); screenShake(4);
        if (Math.abs(this.superTimer - 225) < 2) playSound('blackhole');
      } else if (this.superTimer > 30) {
        Object.assign(targetAngles, ANIM_STATES.win); screenShake(12);
        // Swirling vortex particles
        for (let i = 0; i < 2; i++) {
          let angle = Math.random() * Math.PI * 2; let dist = 300 + Math.random() * 200;
          let px = cx + Math.cos(angle) * dist; let py = cy + Math.sin(angle) * dist;
          particles.push(new Particle(px, py, (cx - px) * 0.1, (cy - py) * 0.1, i % 2 === 0 ? '#bc13fe' : '#00d2ff', 20, Math.random() * 5 + 2, true));
        }
        opponent.isLevitating = true; opponent.velocity.x = 0; opponent.velocity.y = 0;
        opponent.x = lerp(opponent.x, cx, 0.1 * GAME_SPEED); opponent.y = lerp(opponent.y, cy, 0.1 * GAME_SPEED);
        (opponent.angles as any).torso += 30; (opponent.angles as any).sF += 40; (opponent.angles as any).hF -= 40;
        if (Math.floor(this.superTimer) % 6 === 0) {
          opponent.health -= opponent.isBlocking ? 20 : 40;
          playSound('slash');
          spawnHitParticles(opponent.x, opponent.y, false, '#8a2be2'); checkDeath(); updateUI();
        }
      } else if (this.superTimer > 0) {
        if (Math.abs(this.superTimer - 30) < 2) {
          screenShake(100); opponent.isLevitating = false;
          playSound('explosion');
          // Screen flash
          particles.push(new Particle(450, 225, 0, 0, '#fff', 10, 1000, true));
          opponent.health -= opponent.isBlocking ? 400 : 1000; opponent.velocity.y = -30; opponent.velocity.x = (opponent.x < cx ? -40 : 40);
          // Massive multi-layered explosion
          for (let i = 0; i < 150; i++) {
            let color = Math.random() > 0.5 ? '#fff' : (Math.random() > 0.5 ? '#bc13fe' : '#ff0055');
            particles.push(new Particle(cx, cy, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, color, 80, Math.random() * 12 + 4, true));
          }
          // Shockwave ring
          for (let i = 0; i < 360; i += 5) {
            let r = i * Math.PI / 180;
            particles.push(new Particle(cx, cy, Math.cos(r) * 25, Math.sin(r) * 25, '#fff', 30, 6, true));
          }
          checkDeath(); updateUI();
        }
      } else { this.superCasting = false; this.state = 'idle'; }
    }
  }

  drawBone(ctx: CanvasRenderingContext2D, startX: number, startY: number, angleDeg: number, length: number, width: number, color: string) {
    let rad = angleDeg * Math.PI / 180;
    let endX = startX + Math.cos(rad) * length; let endY = startY + Math.sin(rad) * length;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
    return { x: endX, y: endY };
  }

  draw(ctx: CanvasRenderingContext2D, time: number, gameState: GameState) {
    ctx.save();
    if (this.superCasting) {
      ctx.shadowBlur = 40;
      ctx.shadowColor = (this.activeSuper === 'beam' || this.activeSuper === 'triSlash') ? this.superColor1 : this.superColor2;
    }

    let dir = this.facingRight ? 1 : -1;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.ellipse(this.x, 380, 25, 6, 0, 0, Math.PI * 2); ctx.fill();

    let colorFront = this.color; let colorBack = '#080808'; let bodyColor = this.bodyColor;
    if (gameState === 'fatality' && this.health <= 0) { colorFront = '#333'; bodyColor = '#222'; colorBack = '#111'; }

    let hipX = this.x; let hipY = this.y - 45;
    if (gameState === 'fatality' && this.health <= 0) hipY = this.y - 15;

    let kneeB = this.drawBone(ctx, hipX, hipY, 90 + this.angles.hB * dir, 28, 14, colorBack);
    this.drawBone(ctx, kneeB.x, kneeB.y, 90 + (this.angles.hB + this.angles.kB) * dir, 28, 10, colorBack);

    let shoulder = this.drawBone(ctx, hipX, hipY, -90 + this.angles.torso * dir, 45, 18, bodyColor);

    let elbowB = this.drawBone(ctx, shoulder.x, shoulder.y, 90 + this.angles.sB * dir, 22, 12, colorBack);
    this.drawBone(ctx, elbowB.x, elbowB.y, 90 + (this.angles.sB + this.angles.eB) * dir, 22, 10, colorBack);

    ctx.fillStyle = colorFront;
    ctx.beginPath(); ctx.arc(shoulder.x + (this.angles.torso * 0.1), shoulder.y - 15, 13, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = this.superColor2; 
    ctx.beginPath(); ctx.fillRect(shoulder.x - 5, shoulder.y - 22, 10, 4);
    let tailX = shoulder.x - 10 * dir;
    ctx.beginPath(); ctx.moveTo(tailX, shoulder.y - 20); ctx.lineTo(tailX - 15 * dir - Math.sin(time * 0.2) * 5, shoulder.y - 10); ctx.lineTo(tailX, shoulder.y - 18); ctx.fill();

    let kneeF = this.drawBone(ctx, hipX, hipY, 90 + this.angles.hF * dir, 28, 15, colorFront);
    this.drawBone(ctx, kneeF.x, kneeF.y, 90 + (this.angles.hF + this.angles.kF) * dir, 28, 11, colorFront);

    let elbowF = this.drawBone(ctx, shoulder.x, shoulder.y, 90 + this.angles.sF * dir, 22, 13, colorFront);
    this.drawBone(ctx, elbowF.x, elbowF.y, 90 + (this.angles.sF + this.angles.eF) * dir, 22, 11, colorFront);

    ctx.restore();

    // Super Effects
    if (this.superCasting) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (this.activeSuper === 'triSlash' && this.superTimer <= 165) {
        ctx.shadowBlur = 50; ctx.shadowColor = '#fff'; ctx.strokeStyle = '#fff'; ctx.beginPath();
        let drawAlpha = 0;
        if (this.superTimer > 112) { 
          drawAlpha = (this.superTimer - 112) / 53; 
          ctx.moveTo(this.x, this.y - 100); ctx.lineTo(this.x, this.y + 300); 
          if (Math.floor(this.superTimer) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0,0,900,450); }
        }
        else if (this.superTimer > 60) { 
          drawAlpha = (this.superTimer - 60) / 52; 
          ctx.moveTo(this.x - 100, this.y - 40); ctx.lineTo(this.x + 300, this.y - 40); 
          if (Math.floor(this.superTimer) % 2 === 0) { ctx.fillStyle = 'rgba(255,0,0,0.1)'; ctx.fillRect(0,0,900,450); }
        }
        else if (this.superTimer > 5) { 
          drawAlpha = (this.superTimer - 5) / 55; 
          ctx.moveTo(this.x + 100, this.y - 40); ctx.lineTo(this.x - 300, this.y - 40); 
          if (Math.floor(this.superTimer) % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,900,450); }
        }
        ctx.globalAlpha = drawAlpha; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = this.superColor1; ctx.lineWidth = 40; ctx.stroke();
      }
      if (this.activeSuper === 'beam' && this.superTimer <= 120) {
        let beamAlpha = Math.min(1, this.superTimer / 15); ctx.globalAlpha = beamAlpha;
        let beamY = shoulder.y; let beamStartX = elbowF.x; let beamLength = 900; let endX = beamStartX + beamLength * dir;
        
        // Outer Glow
        ctx.shadowBlur = 80 + Math.random() * 60; ctx.shadowColor = this.superColor1; ctx.fillStyle = this.superColor1;
        ctx.beginPath(); ctx.moveTo(beamStartX, beamY - 35); ctx.lineTo(endX, beamY - 120 + Math.random() * 80); ctx.lineTo(endX, beamY + 120 - Math.random() * 80); ctx.lineTo(beamStartX, beamY + 35); ctx.fill();
        
        // Inner Core
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 30; ctx.shadowColor = '#fff';
        ctx.beginPath(); ctx.moveTo(beamStartX, beamY - 15); ctx.lineTo(endX, beamY - 30 + Math.random() * 60); ctx.lineTo(endX, beamY + 30 - Math.random() * 60); ctx.lineTo(beamStartX, beamY + 15); ctx.fill();
        
        // Lightning arcs
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        for(let i=0; i<5; i++) {
          ctx.beginPath(); ctx.moveTo(beamStartX, beamY);
          for(let j=1; j<=8; j++) ctx.lineTo(beamStartX + (beamLength * dir * (j/8)), beamY + (Math.random()-0.5)*150);
          ctx.stroke();
        }
        // Particle flares along beam
        if (Math.random() < 0.3) {
          let flareX = beamStartX + Math.random() * beamLength * dir;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(flareX, beamY + (Math.random()-0.5)*40, 5, 0, Math.PI*2); ctx.fill();
        }
      }
      if (this.activeSuper === 'omnislash' && this.superTimer <= 195) {
        if (this.superTimer > 45) {
          if (Math.floor(this.superTimer) % 12 === 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + (this.facingRight ? 250 : -250), this.y - 120); ctx.stroke();
            ctx.strokeStyle = this.superColor2; ctx.lineWidth = 40; ctx.stroke();
          }
          // Motion trails - multiple afterimages
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = this.superColor2; ctx.globalAlpha = 0.1 * (i + 1);
            ctx.beginPath(); ctx.arc(this.x - (this.velocity.x * i * 2), this.y - 50 - (this.velocity.y * i * 2), 45, 0, Math.PI * 2); ctx.fill();
          }
        } else if (this.superTimer > 0) {
          // Final dive visuals
          ctx.shadowBlur = 60; ctx.shadowColor = '#fff';
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 15;
          ctx.beginPath(); ctx.moveTo(this.x, this.y - 100); ctx.lineTo(this.x, this.y + 100); ctx.stroke();
          ctx.strokeStyle = this.superColor2; ctx.lineWidth = 30; ctx.stroke();
          // Speed lines
          for (let i = 0; i < 5; i++) {
            ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.moveTo(this.x + (Math.random() - 0.5) * 60, this.y - 200); ctx.lineTo(this.x + (Math.random() - 0.5) * 60, this.y + 200); ctx.stroke();
          }
        }
      }
      if (this.activeSuper === 'blackhole' && this.superTimer <= 225) {
        let cx = 900 / 2; let cy = 450 / 2 - 50;
        if (this.superTimer > 30) {
          let progress = (225 - this.superTimer) / 195;
          let radius = progress * 180; if (radius > 180) radius = 180;
          
          // Event Horizon Distortion - stronger
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, radius * 6, 0, Math.PI * 2); ctx.clip();
          if (Math.floor(this.superTimer) % 3 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0,0,900,450);
          }
          ctx.restore();

          let gradient = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 6);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
          gradient.addColorStop(0.05, 'rgba(0, 0, 0, 1)');
          gradient.addColorStop(0.2, 'rgba(138, 43, 226, 0.95)');
          gradient.addColorStop(0.5, 'rgba(0, 210, 255, 0.5)');
          gradient.addColorStop(0.8, 'rgba(255, 0, 85, 0.2)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx, cy, radius * 6, 0, Math.PI * 2); ctx.fill();
          
          // Swirling rings - more rings, faster
          ctx.lineWidth = 4;
          for(let i = 0; i < 15; i++) {
            ctx.strokeStyle = i % 3 === 0 ? '#bc13fe' : (i % 3 === 1 ? '#00d2ff' : '#ff0055'); 
            ctx.globalAlpha = 0.3 + Math.sin(time * 0.15 + i) * 0.5;
            ctx.beginPath(); ctx.ellipse(cx, cy, radius * (1.2 + i*0.5), radius * (0.3 + i*0.2), time * (0.08 + i*0.015) + (i % 2 === 0 ? 0.5 : -0.5), 0, Math.PI * 2); ctx.stroke();
          }
          
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          ctx.shadowBlur = 80; ctx.shadowColor = '#fff';
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
        } else if (this.superTimer > 0) {
          // Final implosion visual
          let implosionRadius = (this.superTimer / 30) * 180;
          ctx.fillStyle = '#fff'; ctx.shadowBlur = 100; ctx.shadowColor = '#fff';
          ctx.beginPath(); ctx.arc(cx, cy, implosionRadius, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Super1, setP1Super1] = useState(0);
  const [p1Super2, setP1Super2] = useState(0);
  const [p2Super1, setP2Super1] = useState(0);
  const [p2Super2, setP2Super2] = useState(0);
  const [finisherText, setFinisherText] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const gameRef = useRef<{
    p1: Fighter | null;
    p2: Fighter | null;
    particles: Particle[];
    screenShake: number;
    time: number;
    keys: Record<string, boolean>;
    cinematicBars: number;
    finisherType?: FinisherType;
    timeScale: number;
    camera: { x: number, y: number, zoom: number, targetX: number, targetY: number, targetZoom: number };
  }>({
    p1: null,
    p2: null,
    particles: [],
    screenShake: 0,
    time: 0,
    keys: {},
    cinematicBars: 0,
    timeScale: 1,
    camera: { x: 450, y: 225, zoom: 1, targetX: 450, targetY: 225, targetZoom: 1 }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      gameRef.current.keys[e.code] = true; 
      gameRef.current.p1?.handleInput(e.code);
      gameRef.current.p2?.handleInput(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => { gameRef.current.keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateUI = () => {
    const { p1, p2 } = gameRef.current;
    if (p1 && p2) {
      setP1Health((p1.health / p1.maxHealth) * 100);
      setP2Health((p2.health / p2.maxHealth) * 100);
      setP1Super1(p1.superMeter1);
      setP1Super2(p1.superMeter2);
      setP2Super1(p2.superMeter1);
      setP2Super2(p2.superMeter2);
    }
  };

  const spawnHitParticles = (x: number, y: number, isBlock: boolean, color?: string) => {
    let pColor = color || (isBlock ? '#00d2ff' : '#ff9d00');
    for (let i = 0; i < 25; i++) {
      gameRef.current.particles.push(new Particle(x, y, (Math.random() - 0.5) * 15, (Math.random() - 1) * 12, pColor, 30 + Math.random() * 20, Math.random() * 3 + 2, true));
    }
  };

  const checkDeath = () => {
    const { p1, p2 } = gameRef.current;
    
    // Clamp health to never go below 0
    if (p1) p1.health = Math.max(0, p1.health);
    if (p2) p2.health = Math.max(0, p2.health);
    
    if (p1 && p2 && (p1.health <= 0 || p2.health <= 0) && gameState !== 'fatality') {
      setGameState('fatality');
      setFinisherText('FINISH HIM!');
      playSound('finish_him');
      gameRef.current.camera.targetZoom = 1.3;
      
      // Stop all super effects
      p1.superCasting = false;
      p2.superCasting = false;
      p1.activeSuper = null;
      p2.activeSuper = null;
      p1.superTimer = 0;
      p2.superTimer = 0;
      
      gameRef.current.finisherType = undefined;
      gameRef.current.particles.push(new Particle(450, 150, 0, 0, '#ff0000', 120, 0, true, "FINISH HIM!"));
      
      // Auto-end after 10 seconds if no finisher
      setTimeout(() => {
        if (gameRef.current.p1 && (gameRef.current.p1.health <= 0 || gameRef.current.p2!.health <= 0) && !gameRef.current.finisherType) {
          setGameState('menu');
          setFinisherText(null);
        }
      }, 10000);
    }
  };

  (window as any).triggerFinisher = (type: FinisherType) => {
    if (gameRef.current.finisherType) return;
    gameRef.current.finisherType = type;
    setFinisherText(type);
    
    const { p1, p2 } = gameRef.current;
    const winner = p1!.health > 0 ? p1! : p2!;
    const loser = p1!.health <= 0 ? p1! : p2!;

    // Cinematic Camera Zoom
    let camX = (winner.x + loser.x) / 2;
    if (camX < 200 || camX > 700) camX = 450;
    gameRef.current.camera.targetX = camX;
    gameRef.current.camera.targetY = (winner.y + loser.y) / 2 - 50;
    // adjust zoom based on distance so both fighters stay visible
    const dist = Math.abs(winner.x - loser.x);
    // padding of 200 world units horizontally
    const maxZoomForDist = 900 / (dist + 200);
    gameRef.current.camera.targetZoom = Math.min(2.2, maxZoomForDist);
    gameRef.current.timeScale = 0.4;

    // Enhanced Finisher Animations
    if (type === 'FATALITY') {
      gameRef.current.particles.push(new Particle(450, 200, 0, 0, '#ff0000', 180, 0, true, 'FATALITY'));
      playSound('fatality');
      // Blood explosion
      for (let i = 0; i < 150; i++) {
        gameRef.current.particles.push(new Particle(loser.x, loser.y - 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, '#ff0000', 100, Math.random() * 10 + 5));
      }
    } else if (type === 'BRUTALITY') {
      gameRef.current.particles.push(new Particle(450, 200, 0, 0, '#ff0000', 180, 0, true, 'BRUTALITY'));
      playSound('brutality');
      // Rapid hits sequence
      let hitCount = 0;
      const interval = setInterval(() => {
        hitCount++;
        winner.x = loser.x + (Math.random() - 0.5) * 100;
        winner.y = loser.y + (Math.random() - 0.5) * 100;
        winner.facingRight = winner.x < loser.x;
        playSound('hit');
        for (let i = 0; i < 10; i++) {
          gameRef.current.particles.push(new Particle(loser.x, loser.y - 60, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, '#ff0000', 30, 5));
        }
        if (hitCount >= 10) {
          clearInterval(interval);
          playSound('explosion');
          for (let i = 0; i < 100; i++) {
            gameRef.current.particles.push(new Particle(loser.x, loser.y - 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, '#ff0000', 80, 12, true));
          }
        }
      }, 100);
    } else if (type === 'FRIENDSHIP') {
      gameRef.current.particles.push(new Particle(450, 200, 0, 0, '#ff00ff', 180, 0, true, 'FRIENDSHIP'));
      playSound('friendship');
      // Confetti rain
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      const interval = setInterval(() => {
        for (let i = 0; i < 15; i++) {
          gameRef.current.particles.push(new Particle(Math.random() * 900, -20, (Math.random() - 0.5) * 5, 5 + Math.random() * 5, colors[Math.floor(Math.random() * colors.length)], 200, 5, true));
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
    } else if (type === 'BABALITY') {
      gameRef.current.particles.push(new Particle(450, 200, 0, 0, '#00d2ff', 180, 0, true, 'BABALITY'));
      playSound('babality');
      // Smoke puff
      for (let i = 0; i < 80; i++) {
        gameRef.current.particles.push(new Particle(loser.x, loser.y - 40, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, '#ffffff', 80, 20, true));
      }
    } else if (type === 'ANIMALITY') {
      gameRef.current.particles.push(new Particle(450, 200, 0, 0, '#ff9d00', 180, 0, true, 'ANIMALITY'));
      playSound('animality');
      // Beast silhouette effect
      const interval = setInterval(() => {
        for (let i = 0; i < 3; i++) {
          gameRef.current.particles.push(new Particle(winner.x, winner.y - 60, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, '#ff9d00', 30, 45, true));
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 3000);
    }
    
    setTimeout(() => {
      setGameState('menu');
      setFinisherText(null);
      gameRef.current.camera.targetZoom = 1;
      gameRef.current.camera.targetX = 450;
      gameRef.current.camera.targetY = 225;
    }, 6000);
  };

  const startGame = () => {
    const isP2AI = gameMode === 'ai';
    gameRef.current.p1 = new Fighter(200, 380, false, true, DEFAULT_P1_CONTROLS, 'beam', 'omnislash');
    gameRef.current.p2 = new Fighter(700, 380, isP2AI, false, DEFAULT_P2_CONTROLS, 'triSlash', 'blackhole');
    gameRef.current.particles = [];
    gameRef.current.time = 0;
    gameRef.current.cinematicBars = 0;
    gameRef.current.timeScale = 1;
    gameRef.current.camera = { x: 450, y: 225, zoom: 1, targetX: 450, targetY: 225, targetZoom: 1 };
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState === 'menu') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const loop = () => {
      const { p1, p2, particles, time, keys, camera } = gameRef.current;
      if (!p1 || !p2) return;

      gameRef.current.time += 1 * GAME_SPEED * gameRef.current.timeScale;

      // Camera Interpolation
      camera.x += (camera.targetX - camera.x) * 0.1;
      camera.y += (camera.targetY - camera.y) * 0.1;
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;

      ctx.save();

      // Apply Screen Shake
      if (gameRef.current.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * gameRef.current.screenShake, (Math.random() - 0.5) * gameRef.current.screenShake);
        gameRef.current.screenShake *= 0.85;
        if (gameRef.current.screenShake < 0.5) gameRef.current.screenShake = 0;
      }

      // Apply Camera Transform
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (gameState === 'fatality') {
        ctx.rotate(Math.sin(time * 0.02) * 0.01);
      }
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);

      // Deep Black Background (extend beyond view so rotating/shaking near edges never shows seams)
      const pad = 2000;
      // visible half-extents in world space
      const halfW = canvas.width / 2 / camera.zoom;
      const halfH = canvas.height / 2 / camera.zoom;
      const minX = camera.x - halfW - pad;
      const maxX = camera.x + halfW + pad;
      const minY = camera.y - halfH - pad;
      const maxY = camera.y + halfH + pad;

      // Deep Black Background covering extra area
      ctx.fillStyle = '#050505';
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      
      // Subtle Grid (tile out far in world space so it appears infinite)
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      let gx = Math.floor(minX / gridSize) * gridSize;
      for(; gx <= maxX; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, minY); ctx.lineTo(gx, maxY); ctx.stroke();
      }
      let gy = Math.floor(minY / gridSize) * gridSize;
      for(; gy <= maxY; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(minX, gy); ctx.lineTo(maxX, gy); ctx.stroke();
      }

      // Floor (also extended far left/right)
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(minX, 380, maxX - minX, 70);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(minX, 380); ctx.lineTo(maxX, 380); ctx.stroke();

      p1.update(p2, keys, gameState, time, particles, checkDeath, updateUI, spawnHitParticles, (amt) => gameRef.current.screenShake = amt, gameRef.current.finisherType);
      p2.update(p1, keys, gameState, time, particles, checkDeath, updateUI, spawnHitParticles, (amt) => gameRef.current.screenShake = amt, gameRef.current.finisherType);

      if (p1.superCasting) { p2.draw(ctx, time, gameState); p1.draw(ctx, time, gameState); }
      else if (p2.superCasting) { p1.draw(ctx, time, gameState); p2.draw(ctx, time, gameState); }
      else { p1.draw(ctx, time, gameState); p2.draw(ctx, time, gameState); }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      if (gameState === 'fatality') {
        if (gameRef.current.cinematicBars < 80) gameRef.current.cinematicBars += 2 * GAME_SPEED;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, gameRef.current.cinematicBars);
        ctx.fillRect(0, canvas.height - gameRef.current.cinematicBars, canvas.width, gameRef.current.cinematicBars);
      }

      ctx.restore();
      animationId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 game-font">
      {gameState === 'menu' && (
        <div className="glass-panel p-12 text-center max-w-2xl w-full animate-in fade-in zoom-in duration-500">
          <h1 className="display-font text-6xl font-black tracking-widest mb-2 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            CYBER FIGHTER
          </h1>
          <p className="text-rose-500 font-bold tracking-widest mb-8 text-sm">NEON UPDATE // TACTICAL COMBAT</p>
          
          <div className="flex gap-4 justify-center mb-8">
            <button 
              onClick={() => setGameMode('ai')}
              className={`mode-btn ${gameMode === 'ai' ? 'active' : ''}`}
            >
              1 PLAYER (VS AI)
            </button>
            <button 
              onClick={() => setGameMode('pvp')}
              className={`mode-btn ${gameMode === 'pvp' ? 'active' : ''}`}
            >
              2 PLAYERS (PVP)
            </button>
          </div>

          <button onClick={startGame} className="btn-primary w-full mb-4">
            ENTER COMBAT
          </button>
          
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary w-full"
          >
            {showSettings ? 'HIDE SETTINGS' : 'SHOW SETTINGS & CONTROLS'}
          </button>

          {showSettings && (
            <div className="mt-8 text-left grid grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-300">
              <div>
                <h3 className="text-cyan-400 font-bold mb-4 border-b border-cyan-400/20 pb-2">P1 (CYBORG)</h3>
                <ul className="space-y-2 text-sm text-white/60">
                  <li className="flex justify-between"><span>MOVE</span> <span className="text-white">W A S D</span></li>
                  <li className="flex justify-between"><span>PUNCH</span> <span className="text-white">SPACE</span></li>
                  <li className="flex justify-between"><span>KICK</span> <span className="text-white">E</span></li>
                  <li className="flex justify-between"><span>SUPERS</span> <span className="text-white">Q / F</span></li>
                </ul>
              </div>
              <div>
                <h3 className="text-rose-500 font-bold mb-4 border-b border-rose-500/20 pb-2">P2 (NINJA)</h3>
                <ul className="space-y-2 text-sm text-white/60">
                  <li className="flex justify-between"><span>MOVE</span> <span className="text-white">ARROWS</span></li>
                  <li className="flex justify-between"><span>PUNCH</span> <span className="text-white">K</span></li>
                  <li className="flex justify-between"><span>KICK</span> <span className="text-white">L</span></li>
                  <li className="flex justify-between"><span>SUPERS</span> <span className="text-white">J / H</span></li>
                </ul>
              </div>
              <div className="col-span-2 mt-4 pt-4 border-t border-white/10">
                <h3 className="text-amber-400 font-bold mb-4 text-center">FINISHERS (DURING "FINISH HIM!")</h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs">
                  <div className="flex justify-between"><span>FATALITY</span> <span className="text-white">↓ ↓ PUNCH</span></div>
                  <div className="flex justify-between"><span>BRUTALITY</span> <span className="text-white">→ ↓ KICK</span></div>
                  <div className="flex justify-between"><span>FRIENDSHIP</span> <span className="text-white">↑ ↑ KICK</span></div>
                  <div className="flex justify-between"><span>BABALITY</span> <span className="text-white">↓ ↑ PUNCH</span></div>
                  <div className="flex justify-between"><span>ANIMALITY</span> <span className="text-white">→ → PUNCH</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState !== 'menu' && (
        <div className="w-full max-w-[900px] flex flex-col items-center">
          <div className="w-full flex justify-between items-start mb-6 px-4">
            <div className="w-[42%] glass-panel p-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-cyan-400 font-bold tracking-widest">P1 CYBORG</span>
                <span className="text-xs text-white/40">{Math.round(p1Health * MAX_HEALTH / 100)} HP</span>
              </div>
              <div className="health-bar-container">
                <div className="health-bar-fill p1-health" style={{ width: `${p1Health}%` }} />
              </div>
              <div className="flex gap-2 mt-3">
                <div className="super-bar-container">
                  <div className="super-bar-fill bg-amber-400" style={{ width: `${p1Super1}%` }} />
                </div>
                <div className="super-bar-container">
                  <div className="super-bar-fill bg-cyan-400" style={{ width: `${p1Super2}%` }} />
                </div>
              </div>
            </div>

            <div className="display-font text-4xl font-black text-white/20 mt-4">VS</div>

            <div className="w-[42%] glass-panel p-4 text-right">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs text-white/40">{Math.round(p2Health * MAX_HEALTH / 100)} HP</span>
                <span className="text-rose-500 font-bold tracking-widest">{gameMode === 'ai' ? 'AI NINJA' : 'P2 NINJA'}</span>
              </div>
              <div className="health-bar-container">
                <div className="health-bar-fill p2-health ml-auto" style={{ width: `${p2Health}%` }} />
              </div>
              <div className="flex gap-2 mt-3">
                <div className="super-bar-container">
                  <div className="super-bar-fill bg-rose-500 ml-auto" style={{ width: `${p2Super2}%` }} />
                </div>
                <div className="super-bar-container">
                  <div className="super-bar-fill bg-amber-400 ml-auto" style={{ width: `${p2Super1}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <canvas 
              ref={canvasRef} 
              width={900} 
              height={450} 
              className="rounded-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            />
            {gameState === 'fatality' && finisherText && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                <h2 className={`display-font text-8xl font-black tracking-[0.2em] drop-shadow-[0_0_30px_rgba(225,29,72,0.8)] animate-ko ${finisherText === 'FRIENDSHIP' ? 'text-emerald-500' : 'text-rose-600'}`}>
                  {finisherText}
                </h2>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
