const GAME_STEPS = 1;

let supportedLanguages = {
  en: 'English',
  gu: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0',
  hi: '\u0939\u093f\u0928\u094d\u0926\u0940',
  mr: '\u092e\u0930\u093e\u0920\u0940',
  te: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41'
};

let localeContent = {};
let shellCopy = { en: {} };
let characters = {};
let activities = [];
let scenes = [];

const AUDIO_PLAYBACK_RATE = 0.75;
const FIRST_PAGE_INSTRUCTION_AUDIO = './assets/english/activity-instruction.ogg';
const FIRST_PAGE_INSTRUCTION_PLAYBACK_RATE = 0.8;
const VOCAB_CARD_CONFIG = [
  { id: 'scam', term: 'Scam', icon: '!', accent: '#ef3340', audio: './assets/english/scam.ogg', meaning: 'A scam is a trick to steal your money, password, or personal details.' },
  { id: 'fake-prize', term: 'Fake Prize / Lucky Draw', icon: '\u2605', accent: '#f59a06', audio: './assets/english/fake-prize-lucky-draw.ogg', meaning: 'A fake prize message says you won something, but it is only trying to fool you.' },
  { id: 'urgency', term: 'Urgency Trick', icon: '\u23f1', accent: '#9b51e0', audio: './assets/english/urgency-trick.ogg', meaning: 'An urgency trick pushes you to act fast so you do not think carefully.' },
  { id: 'fee-trap', term: 'Processing Fee Trap', icon: '\u20b9', accent: '#16b978', audio: './assets/english/processing-fee-trap.ogg', meaning: 'A processing fee trap asks for a small payment before giving a prize or job.' },
  { id: 'social-engineering', term: 'Social Engineering', icon: '\u25c6', accent: '#2f6eee', audio: './assets/english/social-engineering.ogg', meaning: 'Social engineering is when someone tricks people into sharing secrets or doing unsafe things.' }
];
const KEY_CARD_SLOTS = [
  { z: 5, w: 285, h: 320, mt: -160, ml: -142, x: 0, y: 0, r: 0 },
  { z: 4, w: 238, h: 270, mt: -135, ml: -119, x: -132, y: 8, r: -6 },
  { z: 4, w: 238, h: 270, mt: -135, ml: -119, x: 132, y: 8, r: 6 },
  { z: 3, w: 220, h: 250, mt: -125, ml: -110, x: -208, y: 14, r: -9 },
  { z: 3, w: 220, h: 250, mt: -125, ml: -110, x: 208, y: 14, r: 9 }
];
function keyCardSlotVars(slot, prefix = '--kc') {
  return `${prefix}-w:${slot.w}px; ${prefix}-h:${slot.h}px; ${prefix}-mt:${slot.mt}px; ${prefix}-ml:${slot.ml}px; ${prefix}-x:${slot.x}px; ${prefix}-y:${slot.y}px; ${prefix}-r:${slot.r}deg;`;
}
const sfx = {
  correct: new Audio('./assets/sounds/mixkit-winning-notification-2018.ogg'),
  wrong: new Audio('./assets/sounds/incorrect-answer.ogg'),
  pop: new Audio('./assets/sounds/bubble-pop.ogg')
};

// UI button-press feedback for the sound on/off toggle. Kept out of `sfx` so the
// content-mute volume logic never silences it — it stays audible on both on and off.
const buttonClickSound = new Audio('./assets/sounds/button-click.ogg');

let currentLanguage = 'en';
let activeSpeech = null;
let activeSpeechAudio = null;
let availableVoices = [];

const state = {
  step: 1,
  phase: 'activity',
  sceneIndex: 0,
  activitySequenceIndex: 0,
  revealedLineCount: 0,
  scenePageFrameId: '',
  preludeVisible: false,
  preludeDone: false,
  speaking: false,
  muted: false,
  toastTimer: null,
  selected: new Set(),
  bubbleLayout: {},
  classifications: {},
  quizAnswers: {},
  sortPlacements: {},
  selectedSortCard: '',
  sortMistakeCard: '',
  swipeIndex: 0,
  swipeAnswers: {},
  matchPairs: {},
  activeMatch: null,
  matchMistakeKey: '',
  points: 0,
  scoredKeys: new Set(),
  quizLocked: {},
  quizDeadline: 0,
  quizRemaining: 15,
  quizTimerKey: '',
  quizTimerId: null,
  quizQuestionIndex: 0,
  mythIndex: 0,
  mythAnswers: {},
  answerEffectKey: '',
  feedback: '',
  feedbackKind: '',
  reaction: '',
  tutorialActivityId: '',
  tutorialPrompt: '',
  openedCards: new Set(),
  expandedCardId: '',
  keyCardsComplete: false,
  keyCardTurn: 0,
  keyCardPrevTurn: 0,
  keyCardAudioDone: true
};

const ui = {
  loader: document.getElementById('loader-overlay'),
  progressDots: document.getElementById('progressDots'),
  moduleLabel: document.querySelector('.question-label'),
  title: document.getElementById('activityTitle'),
  subtitle: document.getElementById('activitySubtitle'),
  sideProgress: document.getElementById('activitySideProgress'),
  coach: document.getElementById('activityCoach'),
  coachEyebrow: document.querySelector('#coachCard .section-eyebrow'),
  feedbackCard: document.getElementById('feedbackSideCard'),
  feedbackText: document.getElementById('activityFeedback'),
  canvasTitle: document.getElementById('activityCanvasTitle'),
  host: document.getElementById('interactionHost'),
  footerActions: document.getElementById('footerActions'),
  tutorialOverlay: document.getElementById('tutorialOverlay'),
  toast: document.getElementById('toast'),
  muteBtn: document.getElementById('muteBtn')
};

let startupGateRelease = null;

function t(key, replacements = {}) {
  let value = shellCopy[currentLanguage]?.[key] || shellCopy.en[key] || key;
  Object.entries(replacements).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, replacement);
  });
  return value;
}

function getShellSpeechAudio(key) {
  return shellCopy[currentLanguage]?.speechAudio?.[key] || shellCopy.en?.speechAudio?.[key] || '';
}

function getFeedbackSpeechAudio(message) {
  return String(message).startsWith(t('tryAgain')) ? getShellSpeechAudio('tryAgain') : '';
}

function speakFeedbackMessage(message, speechAudio = '') {
  speakLine(message, 'simran', () => {}, speechAudio || getFeedbackSpeechAudio(message));
}

function getLocaleSection(section) {
  return localeContent[currentLanguage]?.[section] || localeContent.en?.[section] || {};
}

function applyLocaleContent() {
  const baseLocale = localeContent.en || {};
  const locale = localeContent[currentLanguage] || baseLocale;
  if (!locale) return;
  shellCopy.en = baseLocale.shell || shellCopy.en || {};
  shellCopy[currentLanguage] = locale.shell || shellCopy.en;
  characters = locale.characters || baseLocale.characters || characters;
  activities = locale.activities || baseLocale.activities || activities;
  scenes = locale.scenes || baseLocale.scenes || scenes;
}

async function loadLocaleContent() {
  try {
    const response = await fetch('./locales.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load locales.json (${response.status})`);
    localeContent = await response.json();
    Object.entries(localeContent).forEach(([code, locale]) => {
      if (locale.name) supportedLanguages[code] = locale.name;
      if (locale.shell) shellCopy[code] = locale.shell;
    });
    applyLocaleContent();
  } catch (error) {
    console.warn('Using bundled game text because locales.json could not be loaded.', error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSceneActivityIndices(scene = scenes[state.sceneIndex]) {
  return scene.activityIndices || [scene.activityIndex];
}

function getCurrentActivity() {
  const scene = scenes[state.sceneIndex] || scenes[0];
  const indices = getSceneActivityIndices(scene);
  return activities[indices[state.activitySequenceIndex] ?? indices[0]];
}

function resetActivityState() {
  stopQuizTimer();
  state.feedback = '';
  state.feedbackKind = '';
  state.reaction = '';
  state.answerEffectKey = '';
  state.selected = new Set();
  state.bubbleLayout = {};
  state.classifications = {};
  state.quizAnswers = {};
  state.sortPlacements = {};
  state.selectedSortCard = '';
  state.sortMistakeCard = '';
  state.swipeIndex = 0;
  state.swipeAnswers = {};
  state.matchPairs = {};
  state.activeMatch = null;
  state.matchMistakeKey = '';
  state.quizLocked = {};
  state.quizDeadline = 0;
  state.quizRemaining = 15;
  state.quizTimerKey = '';
  state.quizQuestionIndex = 0;
  state.mythIndex = 0;
  state.mythAnswers = {};
  state.openedCards = new Set();
  state.expandedCardId = '';
  state.keyCardsComplete = false;
  state.keyCardTurn = 0;
  state.keyCardPrevTurn = 0;
  state.keyCardAudioDone = true;
}

function awardPoints(key, amount = 10) {
  if (state.scoredKeys.has(key)) return;
  state.scoredKeys.add(key);
  state.points += amount;
}

function stopQuizTimer() {
  if (state.quizTimerId) {
    window.clearInterval(state.quizTimerId);
    state.quizTimerId = null;
  }
}

function buildProgressDots() {
  ui.progressDots.innerHTML = '';
  for (let index = 1; index <= GAME_STEPS; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'progress-dot';
    dot.setAttribute('aria-label', t('stepAria', { index }));
    ui.progressDots.appendChild(dot);
  }
}

function updateProgressDots() {
  ui.progressDots.querySelectorAll('.progress-dot').forEach((dot, index) => {
    const step = index + 1;
    dot.classList.toggle('current', state.step === step);
    dot.classList.toggle('active', state.step > step);
  });
}

function setFooterButtons(buttons) {
  ui.footerActions.innerHTML = '';
  buttons.forEach((buttonConfig) => {
    const button = document.createElement('button');
    button.className = `btn${buttonConfig.secondary ? ' secondary' : ''}`;
    button.type = 'button';
    button.textContent = buttonConfig.label;
    button.disabled = Boolean(buttonConfig.disabled);
    button.addEventListener('click', buttonConfig.onClick);
    ui.footerActions.appendChild(button);
  });
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

function currentAudioVolume() {
  // Mute = volume 0 (audio still plays, just silent); unmute = full element
  // volume (1), letting the OS/system volume decide the actual loudness.
  return state.muted ? 0 : 1;
}

function applyAudioMute() {
  const vol = currentAudioVolume();
  Object.values(sfx).forEach((sound) => { sound.volume = vol; });
  if (activeSpeechAudio) activeSpeechAudio.volume = vol;
  if (activeSpeech) activeSpeech.volume = vol;
}

function playSfx(kind) {
  const sound = sfx[kind];
  if (!sound) return;
  sound.volume = currentAudioVolume();
  sound.pause();
  sound.currentTime = 0;
  sound.playbackRate = kind === 'pop' ? 1 : AUDIO_PLAYBACK_RATE;
  sound.play().catch(() => {});
}

function stopActiveSpeechAudio() {
  if (!activeSpeechAudio) return;
  activeSpeechAudio.pause();
  activeSpeechAudio.currentTime = 0;
  activeSpeechAudio = null;
}

function playCardAudio(src, onDone = () => {}) {
  stopActiveSpeechAudio();
  if (!src) {
    onDone();
    return;
  }
  playSpeechAudio(src, onDone, onDone, AUDIO_PLAYBACK_RATE);
}

function setFeedback(message, kind, effectKey = '', speechAudio = '', sfxKind) {
  state.feedback = message;
  state.feedbackKind = kind;
  state.reaction = kind;
  state.answerEffectKey = effectKey;
  const soundToPlay = sfxKind === undefined ? (kind === 'good' ? 'correct' : 'wrong') : sfxKind;
  if (soundToPlay) playSfx(soundToPlay);
  speakFeedbackMessage(message, speechAudio);
  window.setTimeout(() => {
    if (state.reaction === kind && (!effectKey || state.answerEffectKey === effectKey)) {
      state.reaction = '';
      state.answerEffectKey = '';
      renderGame();
    }
  }, 650);
}

function getWrongFeedback(detail = '') {
  const prefix = t('tryAgain');
  return detail ? `${prefix} ${detail}` : prefix;
}

function getActivityWrongFeedback(activity, detail = '') {
  return getWrongFeedback(detail || activity.wrongFeedback || activity.coach || activity.instruction);
}

function getQuestionWrongFeedback(question) {
  return getWrongFeedback(question.wrongFeedback || question.feedback || question.label);
}

function getItemWrongFeedback(item, activity) {
  return getWrongFeedback(item?.wrongFeedback || item?.flag || activity?.wrongFeedback || activity?.coach || '');
}

function getSortWrongFeedback(card, target) {
  const correctZone = card?.answer === 'safe' ? t('safeZone') : t('scamTrickZone');
  const pickedZone = target === 'safe' ? t('safeZone') : t('scamTrickZone');
  return getWrongFeedback(t('sortWrongDetail', {
    card: card?.text || '',
    picked: pickedZone,
    correct: correctZone
  }));
}

function getMatchWrongFeedback(pair) {
  return getWrongFeedback(pair?.feedback || t('matchWrongDetail', {
    clue: pair?.clueText || '',
    sign: pair?.signText || ''
  }));
}

function speakPrompt(text, speechAudio = '') {
  speakLine(text, 'simran', () => {}, speechAudio);
}

function playFirstPageInstruction() {
  cancelVoice();
  playSpeechAudio(
    FIRST_PAGE_INSTRUCTION_AUDIO,
    () => {},
    () => {},
    FIRST_PAGE_INSTRUCTION_PLAYBACK_RATE
  );
}

function clearStartupGateListeners() {
  if (!startupGateRelease) return;
  startupGateRelease();
  startupGateRelease = null;
}

function hideStartupGate() {
  clearStartupGateListeners();
  document.body.classList.remove('startup-gate-active');
  ui.loader?.classList.add('hidden');
}

function activateStartupGate(onOpen) {
  if (!ui.loader) {
    onOpen?.();
    return;
  }
  clearStartupGateListeners();
  ui.loader.classList.remove('hidden');
  document.body.classList.add('startup-gate-active');
  const openGate = (event) => {
    if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
    event.preventDefault?.();
    hideStartupGate();
    onOpen?.();
  };
  ui.loader.addEventListener('pointerdown', openGate, { once: true });
  document.addEventListener('keydown', openGate);
  startupGateRelease = () => {
    ui.loader.removeEventListener('pointerdown', openGate);
    document.removeEventListener('keydown', openGate);
  };
}

function getOptionResultClass(activity, index) {
  if (!state.selected.has(index)) return '';
  if (activity.type === 'multi') {
    const canShowWrong = state.selected.size >= activity.correct.length;
    if (activity.correct.includes(index)) return ' good';
    return canShowWrong ? ' bad' : '';
  }
  return activity.correct === index ? ' good' : ' bad';
}

function getAnswerEffectClass(key, resultClass) {
  if (state.answerEffectKey !== key) return '';
  if (state.reaction === 'good' && resultClass.includes('good')) return ' sparkle';
  if (state.reaction === 'bad' && resultClass.includes('bad')) return ' shake';
  return '';
}

function isActivityCorrect(activity) {
  if (activity.id === 'activity-1') {
    return state.keyCardsComplete;
  }
  if (activity.id === 'q3-pay-first') {
    const cards = getSortCards();
    return cards.every((card) => state.sortPlacements[card.id] === card.answer);
  }
  if (activity.id === 'activity-4') {
    return getMatchPairs().every((pair) => state.matchPairs[pair.clue] === pair.sign);
  }
  if (activity.type === 'single') {
    return state.selected.has(activity.correct);
  }
  if (activity.type === 'multi') {
    return activity.correct.length === state.selected.size && activity.correct.every((index) => state.selected.has(index));
  }
  if (activity.type === 'quizSet') {
    return getQuizFrameQuestions(activity).every((question) => isQuizQuestionCorrect(question));
  }
  if (activity.type === 'classify') {
    return activity.items.every((item, index) => state.swipeAnswers[index] === item.answer || state.classifications[index] === item.answer);
  }
  return activity.items.every((item, index) => state.classifications[index] === item.answer);
}

function hasActivityAttempt(activity) {
  if (activity.id === 'activity-1') {
    return state.openedCards.size > 0;
  }
  if (activity.id === 'q3-pay-first') {
    return getSortCards().every((card) => state.sortPlacements[card.id]);
  }
  if (activity.id === 'activity-4') {
    return getMatchPairs().every((pair) => state.matchPairs[pair.clue]);
  }
  if (activity.type === 'mythFact') {
    return Boolean(state.mythAnswers[state.mythIndex]);
  }
  if (activity.type === 'classify') {
    return Object.keys(state.swipeAnswers).length === activity.items.length || Object.keys(state.classifications).length === activity.items.length;
  }
  if (activity.type === 'quizSet') {
    const question = getCurrentQuizQuestion(activity);
    if (!question) return false;
    const answer = state.quizAnswers[question.id];
    return question.type === 'multi' ? answer instanceof Set && answer.size > 0 : typeof answer === 'number';
  }
  return state.selected.size > 0;
}

function getQuizFrameQuestions(activity) {
  return activity.questions.slice(0, activity.frameQuestionCount ?? 2);
}

function getCurrentQuizQuestion(activity) {
  const questions = getQuizFrameQuestions(activity);
  return questions[Math.min(state.quizQuestionIndex, questions.length - 1)];
}

function isQuizQuestionCorrect(question) {
  const answer = state.quizAnswers[question.id];
  if (question.reflective) return Boolean(answer instanceof Set ? answer.size : typeof answer === 'number');
  if (question.type === 'multi') {
    return answer instanceof Set && question.correct.length === answer.size && question.correct.every((index) => answer.has(index));
  }
  return answer === question.correct;
}

function getQuizOptionResultClass(question, index) {
  const answer = state.quizAnswers[question.id];
  const selected = question.type === 'multi' ? answer?.has(index) : answer === index;
  if (!selected) return '';
  if (question.reflective) return ' good';
  if (question.type === 'multi') {
    const canShowWrong = answer instanceof Set && answer.size >= question.correct.length;
    if (question.correct.includes(index)) return ' good';
    return canShowWrong ? ' bad' : '';
  }
  return question.correct === index ? ' good' : ' bad';
}

function cancelVoice() {
  if (activeSpeech) {
    window.speechSynthesis?.cancel();
    activeSpeech = null;
  }
  if (activeSpeechAudio) {
    activeSpeechAudio.pause();
    activeSpeechAudio.currentTime = 0;
    activeSpeechAudio = null;
  }
  state.speaking = false;
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  availableVoices = window.speechSynthesis.getVoices?.() || [];
}

function pickVoiceForCharacter(who) {
  if (!availableVoices.length) refreshVoices();
  const voices = availableVoices.filter((voice) => /^en(-|_)?/i.test(voice.lang) || /India|Hindi/i.test(voice.name));
  const femaleHints = ['female', 'zira', 'heera', 'neerja', 'susan', 'samantha', 'karen', 'moira', 'tessa', 'veena'];
  const femaleVoices = voices.filter((voice) => femaleHints.some((hint) => voice.name.toLowerCase().includes(hint)));
  const voicePool = femaleVoices.length ? femaleVoices : voices;
  const zaraVoice = voicePool[0] || null;

  if (who === 'zara') return zaraVoice;
  if (who === 'simran') return voicePool.find((voice) => voice !== zaraVoice) || voicePool[1] || zaraVoice;
  return voices.find((voice) => /male|ravi|david|mark|daniel/i.test(voice.name)) || voices[0] || zaraVoice;
}

function voiceSettingsForCharacter(who) {
  const settings = {
    zara: { pitch: 1.18, rate: 0.94 },
    simran: { pitch: 0.98, rate: 0.9 },
    tej: { pitch: 0.82, rate: 0.9 },
    avi: { pitch: 1.05, rate: 0.93 }
  };
  return settings[who] || { pitch: 1.03, rate: 0.92 };
}

function playSpeechAudio(source, onDone, onError, playbackRate = AUDIO_PLAYBACK_RATE) {
  const audio = new Audio(source);
  audio.volume = currentAudioVolume();
  let settled = false;

  const finish = (callback) => {
    if (settled) return;
    settled = true;
    if (activeSpeechAudio === audio) activeSpeechAudio = null;
    callback();
  };

  activeSpeechAudio = audio;
  audio.playbackRate = playbackRate;
  audio.addEventListener('ended', () => finish(onDone), { once: true });
  audio.addEventListener('error', () => finish(onError), { once: true });
  audio.play().catch(() => finish(onError));
}

function speakGeneratedLine(text, who, onDone) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    window.setTimeout(onDone, 650);
    return;
  }

  const speechCurrencyWord = t('speechCurrencyWord');
  const speechText = text.replace(/\u20b9/g, `${speechCurrencyWord} `);
  const utterance = new SpeechSynthesisUtterance(speechText);
  const voice = pickVoiceForCharacter(who);
  const settings = voiceSettingsForCharacter(who);
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-IN';
  utterance.rate = AUDIO_PLAYBACK_RATE;
  utterance.pitch = settings.pitch;
  utterance.onend = onDone;
  utterance.onerror = onDone;
  utterance.volume = currentAudioVolume();
  activeSpeech = utterance;
  window.speechSynthesis.speak(utterance);
}

function speakLine(text, who, onDone, speechAudio = '') {
  cancelVoice();
  if (speechAudio) {
    playSpeechAudio(speechAudio, onDone, () => speakGeneratedLine(text, who, onDone));
    return;
  }
  speakGeneratedLine(text, who, onDone);
}

function playSceneLine() {
  const scene = scenes[state.sceneIndex];
  if (scene.prelude && !state.preludeDone) {
    state.preludeVisible = true;
    state.speaking = true;
    renderGame();
    speakLine(scene.prelude.text, scene.prelude.who, () => {
      state.preludeDone = true;
      state.preludeVisible = false;
      state.speaking = false;
      renderGame();
      window.setTimeout(playSceneLine, 450);
    });
    return;
  }

  const line = scene.lines[state.revealedLineCount];
  if (!line) {
    state.speaking = false;
    renderGame();
    return;
  }

  state.speaking = true;
  state.revealedLineCount += 1;
  renderGame();
  speakLine(line.text, line.who, () => {
    state.speaking = false;
    renderGame();
    if (state.revealedLineCount < scene.lines.length) {
      window.setTimeout(playSceneLine, 450);
    }
  });
}

function startScene(index = 0) {
  cancelVoice();
  state.phase = 'scene';
  state.sceneIndex = index;
  state.step = index * 2 + 1;
  state.activitySequenceIndex = 0;
  state.revealedLineCount = 0;
  state.scenePageFrameId = '';
  state.tutorialPrompt = '';
  state.preludeVisible = false;
  state.preludeDone = !scenes[index].prelude;
  resetActivityState();
  renderGame();
  window.setTimeout(playSceneLine, 250);
}

function goToActivity() {
  cancelVoice();
  state.phase = 'activity';
  state.step = state.sceneIndex * 2 + 2;
  state.activitySequenceIndex = 0;
  resetActivityState();
  renderGame();
  const activity = getCurrentActivity();
  state.tutorialPrompt = activity.instruction;
  showTutorial(activity);
}

function goNextSceneOrComplete() {
  if (state.sceneIndex < scenes.length - 1) {
    startScene(state.sceneIndex + 1);
  } else {
    showToast('All key cards read. Great work!');
    renderGame();
  }
}

function goNextActivityOrScene() {
  const scene = scenes[state.sceneIndex];
  const activityIndices = getSceneActivityIndices(scene);
  if (state.activitySequenceIndex < activityIndices.length - 1) {
    state.activitySequenceIndex += 1;
    resetActivityState();
    renderGame();
    const activity = getCurrentActivity();
    state.tutorialPrompt = activity.instruction;
    showTutorial(activity);
    return;
  }
  goNextSceneOrComplete();
}

function goToNextQuizFrame() {
  stopQuizTimer();
  const activity = getCurrentActivity();
  const questions = getQuizFrameQuestions(activity);
  if (state.quizQuestionIndex < questions.length - 1) {
    state.quizQuestionIndex += 1;
    state.feedback = '';
    state.feedbackKind = '';
    state.reaction = '';
    state.answerEffectKey = '';
    renderGame();
    speakPrompt(getCurrentQuizQuestion(activity).label);
    return;
  }
  goNextActivityOrScene();
}

function goToNextMythFrame() {
  const activity = getCurrentActivity();
  if (state.mythIndex < activity.myths.length - 1) {
    state.mythIndex += 1;
    state.feedback = '';
    state.feedbackKind = '';
    state.reaction = '';
    state.answerEffectKey = '';
    renderGame();
    speakPrompt(activity.myths[state.mythIndex].myth);
    return;
  }
  goNextActivityOrScene();
}

function restartGame() {
  cancelVoice();
  stopQuizTimer();
  state.phase = 'activity';
  state.step = 1;
  state.sceneIndex = 0;
  state.activitySequenceIndex = 0;
  state.revealedLineCount = 0;
  state.scenePageFrameId = '';
  state.preludeVisible = false;
  state.preludeDone = false;
  state.tutorialPrompt = '';
  state.points = 0;
  state.scoredKeys = new Set();
  resetActivityState();
  renderGame();
  playFirstPageInstruction();
}

function renderScene(scene) {
  const visibleLines = scene.lines.slice(0, state.revealedLineCount);
  const showImageOnly = Boolean(scene.prelude && state.preludeVisible && !state.preludeDone);
  const pageFrame = !showImageOnly && state.revealedLineCount > 0
    ? scene.pageFrames?.find((frame) => state.revealedLineCount >= frame.fromLine && state.revealedLineCount <= frame.toLine)
    : null;
  const showNotebookPage = Boolean(pageFrame);
  const pageTurnClass = showNotebookPage && state.scenePageFrameId && state.scenePageFrameId !== pageFrame.id ? ' page-turning' : '';
  if (showNotebookPage) state.scenePageFrameId = pageFrame.id;
  const waitingLine = scene.lines[Math.max(state.revealedLineCount - 1, 0)];
  const transcript = visibleLines.map((line, index) => renderBubble(line, index)).join('');
  const waitingName = scene.prelude && state.preludeVisible && !state.preludeDone
    ? characters[scene.prelude.who].name
    : waitingLine
      ? characters[waitingLine.who].name
      : '';
  const waiting = '';
  const prelude = scene.prelude && state.preludeVisible
    ? `
      <article class="scene-prelude ${showImageOnly ? 'image-only' : ''}">
        <img src="${scene.prelude.image}" alt="${escapeHtml(t('sceneIllustrationAlt'))}">
        <div ${showImageOnly ? 'hidden' : ''}>
          <strong>${characters[scene.prelude.who].name}</strong>
          <p>${escapeHtml(scene.prelude.text)}</p>
        </div>
      </article>
    `
    : '';
  const notebookPage = showNotebookPage
    ? `
      <article class="scene-notebook-page${pageTurnClass}" aria-live="polite">
        <div class="notebook-binding" aria-hidden="true"></div>
        <div class="notebook-sheet">
          <img src="${pageFrame.image}" alt="${escapeHtml(pageFrame.alt || t('sceneIllustrationAlt'))}">
        </div>
      </article>
    `
    : '';

  ui.host.innerHTML = `
    <section class="scam-game scene-stage ${showImageOnly ? 'image-scene-stage' : ''}${showNotebookPage ? ' notebook-scene-stage' : ''}">
      <div class="scene-topline" ${showImageOnly || showNotebookPage ? 'hidden' : ''}>
        <span>${escapeHtml(scene.setting)}</span>
        <strong>${escapeHtml(t('sceneCount', { current: state.sceneIndex + 1, total: scenes.length }))}</strong>
      </div>
      <div class="phone-scam-card" hidden>
        <div class="phone-header">${escapeHtml(t('suspiciousMessageHeader'))}</div>
        <div class="phone-copy">
          ${escapeHtml(t('suspiciousMessageCopy'))}
        </div>
      </div>
      <div class="dialogue-track" aria-live="polite" ${showNotebookPage ? 'hidden' : ''}>
        ${prelude}
        ${transcript}
        ${waiting}
      </div>
      ${notebookPage}
    </section>
  `;
}

function renderBubble(line, index) {
  const person = characters[line.who];
  const side = index % 2 === 0 ? 'left' : 'right';
  return `
    <article class="dialogue-bubble-row ${side}">
      <img class="character-photo ${person.tone}" src="${person.image}" alt="${person.name}">
      <div class="dialogue-bubble">
        <div class="speaker-line">
          <strong>${person.name}</strong>
          <span>${escapeHtml(line.mood)}</span>
        </div>
        <p>${escapeHtml(line.text)}</p>
      </div>
    </article>
  `;
}

function getSortCards(activity = getCurrentActivity()) {
  return activity.sortCards || [];
}

function getMatchPairs(activity = getCurrentActivity()) {
  return activity.matchPairs || [];
}

function getShuffledMatchSigns(activity = getCurrentActivity()) {
  return activity.matchSigns || getMatchPairs(activity).map((pair) => ({ id: pair.sign, text: pair.signText }));
}

function getMatchLineGeometry(leftIndex, rightIndex) {
  const startY = 13 + leftIndex * 25;
  const endY = 13 + rightIndex * 25;
  return `M 6 ${startY} C 38 ${startY}, 62 ${endY}, 94 ${endY}`;
}

function shuffleItems(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function renderScoreStrip(extra = '') {
  return `
    <div class="game-score-strip">
      <strong>${state.points} pts</strong>
      ${extra ? `<span>${escapeHtml(extra)}</span>` : ''}
    </div>
  `;
}

function renderActivity(activity) {
  if (activity.id === 'activity-1') {
    renderBubbleBurstActivity(activity);
    return;
  }
  if (activity.id === 'q3-pay-first') {
    renderSortActivity(activity);
    return;
  }
  if (activity.id === 'activity-4') {
    renderMatchActivity(activity);
    return;
  }
  if (activity.type === 'mythFact') {
    renderMythFactActivity(activity);
    return;
  }
  if (activity.type === 'classify') {
    renderClassifyActivity(activity);
    return;
  }
  if (activity.type === 'quizSet') {
    renderQuizSetActivity(activity);
    return;
  }

  const options = activity.options.map((option, index) => {
    const selected = state.selected.has(index);
    const resultClass = getOptionResultClass(activity, index);
    const effectClass = getAnswerEffectClass(`${activity.id}:${index}`, resultClass);
    return `
      <button class="answer-option${selected ? ' selected' : ''}${resultClass}${effectClass}" type="button" data-option="${index}">
        <span class="${activity.type === 'multi' ? 'check-box' : 'radio-dot'}">${selected && activity.type === 'multi' ? '✓' : ''}</span>
        <span>${escapeHtml(option)}</span>
      </button>
    `;
  }).join('');

  ui.host.innerHTML = `
    <section class="scam-game activity-stage ${state.reaction === 'bad' ? 'is-wrong' : ''}">
      <div class="activity-panel ${state.reaction}">
        ${renderScoreStrip('Choose safely')}
        <div class="activity-prompt">${escapeHtml(activity.instruction)}</div>
        <div class="answer-grid ${activity.type}">${options}</div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.option);
      const effectKey = `${activity.id}:${index}`;
      speakPrompt(activity.instruction, activity.speechAudio?.instruction);
      if (activity.type === 'single') {
        state.selected = new Set([index]);
      } else if (state.selected.has(index)) {
        state.selected.delete(index);
      } else {
        state.selected.add(index);
      }
      if (isActivityCorrect(activity)) {
        setFeedback(`${t('correct')} ${activity.coach}`, 'good', effectKey, activity.speechAudio?.completeFeedback);
      } else if (activity.type === 'single') {
        setFeedback(getActivityWrongFeedback(activity), 'bad', effectKey);
      } else if (activity.correct.includes(index)) {
        setFeedback(t('redFlagFound'), 'good', effectKey, getShellSpeechAudio('redFlagFound'));
      } else {
        setFeedback(getActivityWrongFeedback(activity), 'bad', effectKey);
      }
      renderGame();
    });
  });
}

function renderBubbleBurstActivity(activity) {
  const allCardsOpened = state.keyCardsComplete;
  const openCard = VOCAB_CARD_CONFIG.find((card) => card.id === state.expandedCardId);
  const hasOpenCard = Boolean(openCard);
  const confetti = allCardsOpened
    ? Array.from({ length: 38 }, (_, index) => `
      <i class="key-confetti${index % 5 === 0 ? ' confetti-star' : ''}"
        style="--x:${(index * 31) % 98}%; --delay:${(index % 11) * -0.24}s; --dur:${2.9 + (index % 7) * 0.22}s; --spin:${80 + (index % 8) * 45}deg;"></i>
    `).join('')
    : '';
  const keyCardCloseButton = `
    <button class="tutorial-close-btn key-card-close" type="button" aria-label="Close keyword card">
      <svg width="31" height="31" viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15.5" cy="15.5" r="13.5" stroke="currentColor" stroke-width="2.2" />
        <path
          d="M10.7324 21.3786L9.58252 20.1692L14.1819 15.3314L9.58252 10.4936L10.7324 9.28418L15.3318 14.122L19.9312 9.28418L21.0811 10.4936L16.4817 15.3314L21.0811 20.1692L19.9312 21.3786L15.3318 16.5409L10.7324 21.3786Z"
          fill="currentColor" />
      </svg>
    </button>
  `;
  const wordMotion = '<span class="word-motion" aria-hidden="true"><span></span><span></span><span></span></span>';
  const renderKeyCardFaces = (card, index, frontStrip = 'Tap to open', backStrip = 'Tap to close', closeButton = '', motion = '') => `
    <span class="key-card-inner">
      <span class="key-card-face key-card-front">
        <span class="key-card-number">${index + 1}</span>
        <span class="key-card-icon key-card-icon-${card.id}" aria-hidden="true">${escapeHtml(card.icon)}</span>
        <span class="key-card-term">${escapeHtml(card.term)}</span>
        <span class="key-card-strip">${frontStrip}</span>
      </span>
      <span class="key-card-face key-card-back">
        ${closeButton}
        <span class="key-card-number">${index + 1}</span>
        <span class="key-card-back-title">${escapeHtml(card.term)}</span>
        ${motion}
        <span class="key-card-meaning">${escapeHtml(card.meaning)}</span>
        <span class="key-card-strip">${backStrip}</span>
      </span>
    </span>
  `;
  const cardCount = VOCAB_CARD_CONFIG.length;
  const sequenceDone = state.keyCardTurn >= cardCount;
  const faceIndex = state.keyCardTurn % cardCount;
  const isCycling = state.keyCardPrevTurn !== state.keyCardTurn;
  const cardHtml = VOCAB_CARD_CONFIG.map((card, index) => {
    const hasRead = state.openedCards.has(card.id);
    const slotIndex = (index - faceIndex + cardCount) % cardCount;
    const prevSlotIndex = (index - (state.keyCardPrevTurn % cardCount) + cardCount) % cardCount;
    const slot = KEY_CARD_SLOTS[slotIndex];
    const fromSlot = KEY_CARD_SLOTS[prevSlotIndex];
    const isNext = slotIndex === 0 && !sequenceDone;
    return `
      <button class="key-card${hasOpenCard ? ' is-background' : ''}${hasRead ? ' has-read' : ''}${isNext ? ' is-next' : ''}${isCycling ? ' is-cycling' : ''}" type="button"
        data-key-card="${card.id}"
        style="--card-accent:${card.accent}; z-index:${slot.z}; ${keyCardSlotVars(slot)}${isCycling ? ` ${keyCardSlotVars(fromSlot, '--kf')}` : ''}"
        aria-pressed="${state.expandedCardId === card.id}">
        ${renderKeyCardFaces(card, index)}
      </button>
    `;
  }).join('');
  const openCardIndex = openCard ? VOCAB_CARD_CONFIG.findIndex((card) => card.id === openCard.id) : -1;
  const popupHtml = openCard ? `
    <button class="key-card-overlay" type="button" aria-label="Close keyword card"></button>
    <div class="key-card-popup just-flipped${state.keyCardAudioDone ? '' : ' is-listening'} vocab-popover-${openCard.id}" style="--card-accent:${openCard.accent};">
      ${renderKeyCardFaces(openCard, openCardIndex, 'Tap to open', '', keyCardCloseButton, wordMotion)}
    </div>
  ` : '';

  ui.host.innerHTML = `
    <section class="scam-game activity-stage burst-stage key-stage">
      <div class="activity-panel">
        <div class="bubble-frame key-frame">
          ${confetti ? `<div class="key-confetti-layer" aria-hidden="true">${confetti}</div>` : ''}
          <div class="bubble-mission-banner">
            <span class="mission-book" aria-hidden="true"></span>
            <div><strong>Unlock All <em>Safety Words!</em></strong><small>Open all 5 cards to complete your mission.</small></div>
          </div>
          <div class="bubble-progress-row">
            <strong>Opened: <b>${state.openedCards.size}</b> / ${VOCAB_CARD_CONFIG.length}</strong>
            <div class="bubble-progress-dots">
              ${VOCAB_CARD_CONFIG.map((_, index) => `<i class="${index < state.openedCards.size ? 'found' : ''}"></i>`).join('')}
            </div>
          </div>
          ${popupHtml}
          <div class="key-card-grid${hasOpenCard ? ' is-popup-open' : ''}" aria-label="Scam safety key cards">${cardHtml}</div>
        </div>
      </div>
    </section>
  `;

  if (isCycling) {
    state.keyCardPrevTurn = state.keyCardTurn;
    window.setTimeout(() => {
      ui.host.querySelectorAll('.key-card.is-cycling').forEach((el) => el.classList.remove('is-cycling'));
    }, 680);
  }

  const closeOpenKeywordCard = () => {
    if (!state.expandedCardId) return;
    if (!state.keyCardAudioDone) return;
    const popup = ui.host.querySelector('.key-card-popup');
    state.answerEffectKey = `close:${state.expandedCardId}`;
    stopActiveSpeechAudio();
    const advanceTurn = () => {
      if (state.keyCardTurn < VOCAB_CARD_CONFIG.length) state.keyCardTurn += 1;
    };
    if (popup && !popup.classList.contains('just-closed')) {
      popup.classList.remove('just-flipped');
      popup.classList.add('just-closed');
      setTimeout(() => {
        state.expandedCardId = '';
        advanceTurn();
        renderGame();
      }, 620);
      return;
    }
    state.expandedCardId = '';
    advanceTurn();
    renderGame();
  };

  ui.host.querySelectorAll('[data-key-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = VOCAB_CARD_CONFIG.find((item) => item.id === button.dataset.keyCard);
      if (!card) return;
      if (state.expandedCardId) return;
      const cardIndex = VOCAB_CARD_CONFIG.indexOf(card);
      if (state.keyCardTurn < VOCAB_CARD_CONFIG.length && cardIndex !== state.keyCardTurn) {
        if (!button.classList.contains('is-denied')) {
          button.classList.add('is-denied');
          window.setTimeout(() => button.classList.remove('is-denied'), 520);
        }
        showToast(`Open card ${state.keyCardTurn + 1} first!`);
        return;
      }
      state.expandedCardId = card.id;
      state.answerEffectKey = card.id;
      state.keyCardsComplete = false;
      state.openedCards.add(card.id);
      awardPoints(`${activity.id}:${card.id}`, 10);
      const isFinalCard = state.openedCards.size === VOCAB_CARD_CONFIG.length;
      state.keyCardAudioDone = false;
      playCardAudio(card.audio, () => {
        state.keyCardAudioDone = true;
        if (!isFinalCard) {
          ui.host.querySelector('.key-card-popup')?.classList.remove('is-listening');
          return;
        }
        state.keyCardsComplete = true;
        renderGame();
      });
      renderGame();
    });
  });

  ui.host.querySelector('.key-card-overlay')?.addEventListener('click', closeOpenKeywordCard);
  ui.host.querySelector('.key-card-close')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeOpenKeywordCard();
  });
  ui.host.querySelector('.key-card-popup')?.addEventListener('click', closeOpenKeywordCard);
  return;

  const safeBubbles = [
    { text: 'CHECK OFFICIAL|SOURCES', icon: 'shield-alt', skin: 'gold' },
    { text: 'ASK A TRUSTED|ADULT', icon: 'people', skin: 'aqua' }
  ];
  const flagBubbles = [
    ['UNKNOWN|NUMBER', 'phone', 'orange'],
    ['BIG PRIZE!', 'gift', 'pink'],
    ['PAY ₹299|TO GET PRIZE', 'money', 'lavender'],
    ['HURRY!|ONLY 2 HOURS', 'alarm', 'blue'],
    ['SHORT LINK', 'chain', 'purple'],
    ['100%|GUARANTEED', 'guarantee', 'yellow']
  ];
  const bubbles = [
    ...activity.options.map((option, index) => ({
      id: `flag-${index}`,
      text: flagBubbles[index][0],
      redFlag: true,
      optionIndex: index,
      icon: flagBubbles[index][1],
      skin: flagBubbles[index][2]
    })),
    { id: 'flag-sender', text: 'FROM UNKNOWN|SENDER', redFlag: true, optionIndex: 0, icon: 'envelope', skin: 'cyan' },
    ...safeBubbles.map((bubble, index) => ({ id: `safe-${index}`, redFlag: false, ...bubble }))
  ];

  if (!state.bubbleLayout[activity.id]) {
    const positions = [
      [20, 30, 0.88], [48, 25, 0.88], [76, 30, 0.88],
      [17, 61, 0.84], [38, 56, 0.84], [61, 57, 0.84],
      [84, 62, 0.84], [50, 75, 0.78], [74, 78, 0.78]
    ];
    state.bubbleLayout[activity.id] = bubbles.reduce((layout, bubble, index) => {
      layout[bubble.id] = {
        position: positions[index],
        driftX: 0,
        driftY: 0,
        duration: (3.8 + Math.random() * 2.2).toFixed(2)
      };
      return layout;
    }, {});
  }

  const bubbleHtml = bubbles.map((bubble, index) => {
    const layout = state.bubbleLayout[activity.id]?.[bubble.id];
    const [left, top, scale] = layout?.position || [50, 50, 1];
    const selected = bubble.redFlag && state.selected.has(bubble.optionIndex);
    const popping = selected && state.answerEffectKey === bubble.id && state.reaction === 'good';
    const wrong = !bubble.redFlag && state.answerEffectKey === bubble.id && state.reaction === 'bad';
    const longText = bubble.text.length > 34;
    if (selected && !popping) return '';
    return `
      <button
        class="burst-bubble skin-${bubble.skin}${bubble.redFlag ? ' red-flag' : ' safe-bubble'}${longText ? ' long-bubble' : ''}${popping ? ' popped' : ''}${wrong ? ' wrong-pop' : ''}"
        type="button"
        data-bubble="${bubble.id}"
        style="--x:${left}%; --y:${top}%; --s:${scale}; --dx:${layout?.driftX || 10}px; --dy:${layout?.driftY || -12}px; --dur:${layout?.duration || 4.4}s; --d:${index * -0.35}s;"
        ${selected ? 'disabled' : ''}>
        <i class="bubble-sprite sprite-${bubble.icon}" aria-hidden="true"></i>
        <span>${bubble.text.split('|').map((line) => escapeHtml(line)).join('<br>')}</span>
      </button>
    `;
  }).join('');
  const riskyLeft = activity.correct.length - state.selected.size;

  ui.host.innerHTML = `
    <section class="scam-game activity-stage burst-stage ${state.reaction === 'bad' ? 'is-wrong' : ''}">
      <div class="activity-panel">
        <div class="bubble-frame">
          <div class="bubble-mission-banner">
            <span class="mission-bubble" aria-hidden="true"></span>
            <div><strong>Pop All <em>Red Flags!</em></strong><small>Tap the red-flag bubbles to pop them.</small></div>
          </div>
          <div class="bubble-progress-row">
            <strong>Found: <b>${activity.correct.length - riskyLeft}</b> / ${activity.correct.length}</strong>
            <div class="bubble-progress-dots">
              ${activity.correct.map((_, index) => `<i class="${index < state.selected.size ? 'found' : ''}"></i>`).join('')}
            </div>
          </div>
          <div class="bubble-arena">${bubbleHtml}</div>
        </div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-bubble]').forEach((button) => {
    button.addEventListener('click', () => {
      const bubble = bubbles.find((item) => item.id === button.dataset.bubble);
      if (!bubble) return;
      if (bubble.redFlag) {
        state.selected.add(bubble.optionIndex);
        awardPoints(`${activity.id}:${bubble.optionIndex}`, 10);
        if (isActivityCorrect(activity)) {
          setFeedback(`${t('correct')} ${activity.coach}`, 'good', bubble.id, activity.speechAudio?.completeFeedback, 'pop');
        } else {
          setFeedback(t('redFlagFound'), 'good', bubble.id, getShellSpeechAudio('redFlagFound'), 'pop');
        }
      } else {
        state.reaction = 'bad';
        state.answerEffectKey = bubble.id;
        state.feedback = getActivityWrongFeedback(activity, t('safeBubbleWrongDetail'));
        state.feedbackKind = 'bad';
        playSfx('wrong');
        speakFeedbackMessage(state.feedback);
        window.setTimeout(() => {
          if (state.answerEffectKey === bubble.id && state.reaction === 'bad') {
            state.reaction = '';
            state.answerEffectKey = '';
            state.feedback = '';
            state.feedbackKind = '';
            renderGame();
          }
        }, 2000);
      }
      renderGame();
    });
  });
}

function showWrongSortAttempt(cardId, detail = '') {
  state.sortMistakeCard = cardId;
  state.answerEffectKey = cardId;
  state.feedback = detail || t('tryAgain');
  state.feedbackKind = 'bad';
  state.reaction = 'bad';
  playSfx('wrong');
  speakFeedbackMessage(state.feedback);
  renderGame();
  window.setTimeout(() => {
    if (state.sortMistakeCard === cardId && state.reaction === 'bad') {
      state.sortMistakeCard = '';
      state.feedback = '';
      state.feedbackKind = '';
      state.reaction = '';
      state.answerEffectKey = '';
      renderGame();
    }
  }, 2000);
}

function renderSortActivity(activity) {
  const cards = getSortCards();
  const poolCards = cards.filter((card) => !state.sortPlacements[card.id]);
  const scamCards = cards.filter((card) => state.sortPlacements[card.id] === 'scam');
  const safeCards = cards.filter((card) => state.sortPlacements[card.id] === 'safe');
  const placedCount = cards.length - poolCards.length;

  const renderCard = (card) => {
    const placement = state.sortPlacements[card.id];
    const result = placement ? (placement === card.answer ? ' correct' : ' wrong') : '';
    const sparkle = placement === card.answer && state.answerEffectKey === card.id && state.reaction === 'good' ? ' sparkle' : '';
    const mistake = !placement && state.sortMistakeCard === card.id && state.reaction === 'bad' ? ' wrong' : '';
    return `
      <button class="sort-card${result}${sparkle}${mistake}${state.selectedSortCard === card.id ? ' selected' : ''}" type="button" draggable="true" data-card="${card.id}">
        ${escapeHtml(card.text)}
      </button>
    `;
  };

  ui.host.innerHTML = `
    <section class="scam-game activity-stage sort-stage">
      <div class="activity-panel">
        <div class="sort-frame">
          <div class="sort-info-row">
            <div class="bubble-info-card"><strong>${escapeHtml(t('cardsSorted', { count: placedCount, total: cards.length }))}</strong></div>
            <div class="bubble-info-card"><strong>${escapeHtml(t('tipLabel'))}</strong> ${escapeHtml(t('sortTip'))}</div>
          </div>
          <div class="sort-pool" data-drop-zone="pool">${poolCards.map(renderCard).join('')}</div>
          <div class="sort-zones">
            <div class="sort-zone scam-zone" data-drop-zone="scam">
              <strong>${escapeHtml(t('scamTrickZone'))}</strong>
              <div>${scamCards.map(renderCard).join('')}</div>
            </div>
            <div class="sort-zone safe-zone" data-drop-zone="safe">
              <strong>${escapeHtml(t('safeZone'))}</strong>
              <div>${safeCards.map(renderCard).join('')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  let draggedCard = null;
  ui.host.querySelectorAll('[data-card]').forEach((cardEl) => {
    cardEl.addEventListener('dragstart', (event) => {
      draggedCard = cardEl.dataset.card;
      event.dataTransfer?.setData('text/plain', draggedCard);
    });
    cardEl.addEventListener('click', () => {
      if (state.sortPlacements[cardEl.dataset.card]) {
        return;
      }
      state.selectedSortCard = state.selectedSortCard === cardEl.dataset.card ? '' : cardEl.dataset.card;
      renderGame();
    });
  });

  ui.host.querySelectorAll('[data-drop-zone]').forEach((zone) => {
    zone.addEventListener('dragover', (event) => event.preventDefault());
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      const cardId = event.dataTransfer?.getData('text/plain') || draggedCard;
      const target = zone.dataset.dropZone;
      if (!cardId || target === 'pool') return;
      state.selectedSortCard = '';
      const card = cards.find((item) => item.id === cardId);
      const correct = card?.answer === target;
      if (correct) {
        state.sortPlacements[cardId] = target;
        state.sortMistakeCard = '';
        awardPoints(`${activity.id}:${cardId}`, 10);
        setFeedback(t('correctPlacement'), 'good', cardId);
      } else {
        showWrongSortAttempt(cardId, getSortWrongFeedback(card, target));
      }
      renderGame();
    });
  });

  ui.host.querySelectorAll('.sort-zone').forEach((zone) => {
    zone.addEventListener('click', (event) => {
      if (event.target.closest('[data-card]')) return;
      const firstCard = cards.find((card) => card.id === state.selectedSortCard) || poolCards[0];
      if (!firstCard || state.sortPlacements[firstCard.id]) return;
      const target = zone.dataset.dropZone;
      state.selectedSortCard = '';
      const correct = firstCard.answer === target;
      if (correct) {
        state.sortPlacements[firstCard.id] = target;
        state.sortMistakeCard = '';
        awardPoints(`${activity.id}:${firstCard.id}`, 10);
        setFeedback(t('correctPlacement'), 'good', firstCard.id);
      } else {
        showWrongSortAttempt(firstCard.id, getSortWrongFeedback(firstCard, target));
      }
      renderGame();
    });
  });
}

function startQuizTimer(activity, question) {
  const key = `${activity.id}:${question.id}`;
  if (state.quizTimerKey === key && state.quizTimerId) return;
  stopQuizTimer();
  state.quizTimerKey = key;
  state.quizRemaining = 15;
  state.quizDeadline = Date.now() + 15000;
  state.quizTimerId = window.setInterval(() => {
    const remaining = Math.max(0, Math.ceil((state.quizDeadline - Date.now()) / 1000));
    if (remaining !== state.quizRemaining) {
      state.quizRemaining = remaining;
      const timerEl = ui.host.querySelector('[data-timer-value]');
      const barEl = ui.host.querySelector('.timer-fill');
      if (timerEl) timerEl.textContent = `${remaining}s`;
      if (barEl) barEl.style.transform = `scaleX(${remaining / 15})`;
    }
    if (remaining <= 0) {
      stopQuizTimer();
      state.quizLocked[question.id] = true;
      state.feedback = t('timeUp');
      state.feedbackKind = 'bad';
      state.reaction = 'bad';
      renderGame();
    }
  }, 250);
}

function renderQuizSetActivity(activity) {
  stopQuizTimer();
  const frameQuestions = getQuizFrameQuestions(activity);
  const questions = frameQuestions
    .filter((_, questionIndex) => questionIndex === state.quizQuestionIndex)
    .map((question) => {
    const answer = state.quizAnswers[question.id];
    const locked = Boolean(state.quizLocked[question.id]);
    const options = question.options.map((option, optionIndex) => {
      const selected = question.type === 'multi' ? answer?.has(optionIndex) : answer === optionIndex;
      const correctOption = question.reflective ? selected : question.type === 'multi'
        ? question.correct.includes(optionIndex)
        : question.correct === optionIndex;
      const resultClass = locked
        ? correctOption
          ? ' good'
          : selected
            ? ' bad'
            : ''
        : getQuizOptionResultClass(question, optionIndex);
      const effectClass = getAnswerEffectClass(`${question.id}:${optionIndex}`, resultClass);
      return `
        <button class="answer-option${selected ? ' selected' : ''}${resultClass}${effectClass}" type="button" data-question="${question.id}" data-option="${optionIndex}" ${locked ? 'disabled' : ''}>
          <span class="${question.type === 'multi' ? 'check-box' : 'radio-dot'}">${selected && question.type === 'multi' ? '✓' : ''}</span>
          <span>${escapeHtml(option)}</span>
        </button>
      `;
    }).join('');

    return `
      <article class="quiz-question-card">
        <div class="quiz-frame-count">${escapeHtml(t('countOf', { current: state.quizQuestionIndex + 1, total: frameQuestions.length }))}</div>
        <div class="quiz-question-title">${escapeHtml(question.label)}</div>
        <div class="answer-grid ${question.type}">${options}</div>
      </article>
    `;
  }).join('');

  ui.host.innerHTML = `
    <section class="scam-game activity-stage final-activity-stage ${state.reaction === 'bad' ? 'is-wrong' : ''}">
      <div class="activity-panel ${state.reaction}">
        ${renderScoreStrip(t('quizLabel'))}
        <div class="activity-prompt">${escapeHtml(activity.instruction)}</div>
        <div class="case-study-card">${escapeHtml(activity.intro)}</div>
        <div class="quiz-question-stack">${questions}</div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => {
      const question = activity.questions.find((item) => item.id === button.dataset.question);
      const optionIndex = Number(button.dataset.option);
      const effectKey = `${button.dataset.question}:${optionIndex}`;
      if (!question || state.quizLocked[question.id]) return;
      speakPrompt(question.label);

      if (question.type === 'multi') {
        const next = new Set(state.quizAnswers[question.id] || []);
        if (next.has(optionIndex)) {
          next.delete(optionIndex);
        } else {
          next.add(optionIndex);
        }
        state.quizAnswers[question.id] = next;
      } else {
        state.quizAnswers[question.id] = optionIndex;
      }

      if (question.reflective || isQuizQuestionCorrect(question)) {
        awardPoints(`${activity.id}:${question.id}`, 10);
        setFeedback(question.feedback, 'good', effectKey);
      } else if (question.type === 'single') {
        setFeedback(getQuestionWrongFeedback(question), 'bad', effectKey);
      } else if (question.correct.includes(optionIndex)) {
        setFeedback(t('redFlagFound'), 'good', effectKey, getShellSpeechAudio('redFlagFound'));
      } else {
        setFeedback(getQuestionWrongFeedback(question), 'bad', effectKey);
      }
      const currentAnswer = state.quizAnswers[question.id];
      const multiComplete = question.type === 'multi' && currentAnswer instanceof Set && currentAnswer.size >= question.correct.length;
      if (question.type === 'single' || question.reflective || isQuizQuestionCorrect(question) || multiComplete) {
        state.quizLocked[question.id] = true;
        stopQuizTimer();
      }
      renderGame();
    });
  });
}

function renderMythFactActivity(activity) {
  const myth = activity.myths[state.mythIndex];
  const answer = state.mythAnswers[state.mythIndex];
  const speakers = [
    { name: 'Simran', initial: 'S' },
    { name: 'Tej', initial: 'T' },
    { name: 'Zara', initial: 'Z' }
  ];
  const speaker = speakers[state.mythIndex % speakers.length];
  const bustClass = answer === 'myth' ? ' correct' : answer ? ' dim' : '';
  const keepClass = answer === 'truth' ? ' wrong' : answer ? ' dim' : '';

  ui.host.innerHTML = `
    <section class="scam-game activity-stage final-activity-stage myth-stage-shell">
      <div class="quest-stage myth-panel${answer ? ' answered' : ''}">
        <div class="speaker-card">
          <div class="speaker-badge">${escapeHtml(speaker.initial)}</div>
          <div>
            <strong>${escapeHtml(speaker.name)}</strong>
            <span>${escapeHtml(t('mythSpeakerPrompt'))}</span>
          </div>
        </div>
        <div class="myth-bubble">
          <div class="myth-bubble-label">${escapeHtml(t('statementLabel'))}</div>
          <div class="myth-statement">"${escapeHtml(myth.myth)}"</div>
        </div>
        <div class="myth-actions">
          <button class="myth-btn${bustClass}" type="button" data-myth-answer="myth" ${answer ? 'disabled' : ''}>
            ${escapeHtml(t('mythButtonLine1'))}<br>${escapeHtml(t('mythButtonLine2'))}
          </button>
          <button class="myth-btn${keepClass}" type="button" data-myth-answer="truth" ${answer ? 'disabled' : ''}>
            ${escapeHtml(t('truthButtonLine1'))}<br>${escapeHtml(t('truthButtonLine2'))}
          </button>
        </div>
        <div class="myth-fact ${answer ? 'show' : ''}">
          <strong>${escapeHtml(t('factLabel'))}</strong>
          <p>${answer ? escapeHtml(myth.fact) : ''}</p>
        </div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-myth-answer]').forEach((button) => {
    button.addEventListener('click', () => {
      const picked = button.dataset.mythAnswer;
      state.mythAnswers[state.mythIndex] = picked;
      state.feedback = '';
      state.feedbackKind = '';
      state.reaction = picked === 'myth' ? 'good' : 'bad';
      state.answerEffectKey = `myth:${state.mythIndex}:${picked}`;
      playSfx(picked === 'myth' ? 'correct' : 'wrong');
      speakLine(myth.fact, 'simran', () => {});
      renderGame();
      window.setTimeout(() => {
        state.reaction = '';
        state.answerEffectKey = '';
      }, 650);
    });
  });
}

function renderSwipeActivity(activity) {
  const current = activity.items[state.swipeIndex];
  const answeredCount = Object.keys(state.swipeAnswers).length;
  const done = answeredCount >= activity.items.length;
  const summary = done
    ? activity.items.map((item, index) => {
      const picked = state.swipeAnswers[index];
      const correct = picked === item.answer;
      return `
        <li class="${correct ? 'correct' : 'wrong'}">
          <strong>${escapeHtml(item.from)}</strong>
          <span>${escapeHtml(t('yourAnswerSummary', { picked: picked || t('noneLabel'), correct: item.answer }))}</span>
        </li>
      `;
    }).join('')
    : '';

  ui.host.innerHTML = `
    <section class="scam-game activity-stage swipe-stage">
      <div class="activity-panel">
        ${renderScoreStrip(done ? t('deckComplete') : `${state.swipeIndex + 1} of ${activity.items.length}`)}
        <div class="activity-prompt">${escapeHtml(activity.instruction)}</div>
        ${done ? `
          <div class="swipe-summary">
            <h4>${escapeHtml(t('resultsLabel'))}</h4>
            <ul>${summary}</ul>
          </div>
        ` : `
          <div class="swipe-deck">
            <article class="swipe-card phone-choice ${current.app}" data-swipe-card>
              <div class="mock-phone">
                <div class="mock-status"><span>10:${15 + state.swipeIndex * 7}</span><span>4G</span></div>
            <div class="mock-appbar">${escapeHtml(t(current.app === 'whatsapp' ? 'appWhatsApp' : current.app === 'popup' ? 'appBrowser' : 'appInstagramDm'))}</div>
                <div class="mock-screen-body">
                  <small>${escapeHtml(current.from)}</small>
                  <p>${escapeHtml(current.message)}</p>
                </div>
              </div>
              <small>${escapeHtml(current.label)}</small>
            </article>
          </div>
          <div class="swipe-actions">
            <button type="button" data-swipe="real">${escapeHtml(t('safeButton'))}</button>
            <button type="button" data-swipe="scam">${escapeHtml(t('scamButton'))}</button>
          </div>
        `}
      </div>
    </section>
  `;

  const answerSwipe = (value) => {
    const item = activity.items[state.swipeIndex];
    if (!item) return;
    state.swipeAnswers[state.swipeIndex] = value;
    state.classifications[state.swipeIndex] = value;
    const correct = value === item.answer;
    if (correct) awardPoints(`${activity.id}:${state.swipeIndex}`, 10);
    setFeedback(correct ? item.flag : getItemWrongFeedback(item, activity), correct ? 'good' : 'bad', `swipe:${state.swipeIndex}:${value}`);
    state.swipeIndex += 1;
    renderGame();
  };

  ui.host.querySelectorAll('[data-swipe]').forEach((button) => {
    button.addEventListener('click', () => answerSwipe(button.dataset.swipe));
  });

  const card = ui.host.querySelector('[data-swipe-card]');
  if (card) {
    let startX = 0;
    card.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener('pointerup', (event) => {
      const deltaX = event.clientX - startX;
      if (Math.abs(deltaX) < 45) return;
      card.classList.add(deltaX > 0 ? 'fly-right' : 'fly-left');
      window.setTimeout(() => answerSwipe(deltaX > 0 ? 'scam' : 'real'), 180);
    });
  }
}

function renderMatchActivity(activity) {
  const pairs = getMatchPairs();
  const signs = getShuffledMatchSigns();
  const completed = pairs.every((pair) => state.matchPairs[pair.clue]);
  if (completed) {
    ui.host.innerHTML = `
      <section class="scam-game activity-stage match-stage">
        <div class="activity-panel">
          ${renderScoreStrip(t('matchedCount', { count: pairs.length, total: pairs.length }))}
          <div class="activity-prompt">${escapeHtml(t('matchPrompt'))}</div>
          <div class="match-complete-list">
            ${pairs.map((pair, index) => `
              <div class="match-complete-row" style="--i:${index};">
                <button class="match-node clue-node paired" type="button" disabled>
                  ${escapeHtml(pair.clueText)}
                </button>
                <span class="match-arrow" aria-hidden="true">&rarr;</span>
                <button class="match-node sign-node paired" type="button" disabled>
                  ${escapeHtml(pair.signText)}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
    return;
  }
  const lines = pairs
    .map((pair, leftIndex) => ({ pair, leftIndex }))
    .filter(({ pair }) => state.matchPairs[pair.clue])
    .map(({ pair, leftIndex }) => {
      const correct = state.matchPairs[pair.clue] === pair.sign;
      const rightIndex = Math.max(0, signs.findIndex((sign) => sign.id === state.matchPairs[pair.clue]));
      return `<path class="${correct ? 'correct' : 'wrong'}" d="${getMatchLineGeometry(leftIndex, rightIndex)}" />`;
    }).join('');

  ui.host.innerHTML = `
    <section class="scam-game activity-stage match-stage">
      <div class="activity-panel">
        ${renderScoreStrip(t('matchedCount', { count: Object.keys(state.matchPairs).length, total: pairs.length }))}
        <div class="activity-prompt">${escapeHtml(t('matchPrompt'))}</div>
        <div class="match-board${completed ? ' complete-shuffle' : ''}">
          <div class="match-column">
            ${pairs.map((pair) => {
              const clueMistake = state.matchMistakeKey.startsWith(`${pair.clue}:`);
              return `
              <button class="match-node clue-node${state.activeMatch === pair.clue ? ' active' : ''}${state.matchPairs[pair.clue] ? ' paired' : ''}${clueMistake ? ' shake' : ''}" type="button" data-clue="${pair.clue}" ${state.matchPairs[pair.clue] ? 'disabled' : ''}>
                ${escapeHtml(pair.clueText)}
              </button>
            `;
            }).join('')}
          </div>
          <svg class="match-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          <div class="match-column">
            ${signs.map((sign, index) => `
              <button class="match-node sign-node${state.matchMistakeKey.endsWith(`:${sign.id}`) ? ' shake' : ''}" type="button" data-sign="${sign.id}" style="--i:${index};">
                ${escapeHtml(sign.text)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-clue]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.matchPairs[button.dataset.clue]) return;
      state.activeMatch = button.dataset.clue;
      state.matchMistakeKey = '';
      if (state.feedbackKind === 'bad') {
        state.feedback = '';
        state.feedbackKind = '';
        state.reaction = '';
        state.answerEffectKey = '';
      }
      renderGame();
    });
  });
  ui.host.querySelectorAll('[data-sign]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.activeMatch) {
        showToast(t('pickClueFirst'));
        return;
      }
      const pair = pairs.find((item) => item.clue === state.activeMatch);
      const correct = pair?.sign === button.dataset.sign;
      if (correct) {
        state.matchPairs[state.activeMatch] = button.dataset.sign;
        state.matchMistakeKey = '';
        awardPoints(`${activity.id}:${state.activeMatch}`, 10);
        setFeedback(t('correctMatch'), 'good', state.activeMatch);
        state.activeMatch = null;
      } else {
        const mistakeKey = `${state.activeMatch}:${button.dataset.sign}`;
        state.matchMistakeKey = mistakeKey;
        state.feedback = getMatchWrongFeedback(pair);
        state.feedbackKind = 'bad';
        state.reaction = 'bad';
        state.answerEffectKey = mistakeKey;
        playSfx('wrong');
        speakFeedbackMessage(state.feedback);
        window.setTimeout(() => {
          if (state.matchMistakeKey === mistakeKey) {
            state.matchMistakeKey = '';
            state.feedback = '';
            state.feedbackKind = '';
            state.reaction = '';
            state.answerEffectKey = '';
            renderGame();
          }
        }, 650);
      }
      renderGame();
    });
  });
}

function renderClassifyActivity(activity) {
  const items = activity.items.map((item, index) => {
    const picked = state.classifications[index];
    const answeredCorrectly = picked && picked === item.answer;
    const answeredWrongly = picked && picked !== item.answer;
    const realResultClass = picked === 'real' ? (item.answer === 'real' ? 'selected good' : 'selected bad') : '';
    const scamResultClass = picked === 'scam' ? (item.answer === 'scam' ? 'selected good' : 'selected bad') : '';
    const realEffectClass = getAnswerEffectClass(`classify:${index}:real`, realResultClass);
    const scamEffectClass = getAnswerEffectClass(`classify:${index}:scam`, scamResultClass);
    return `
      <article class="phone-choice ${item.app} ${answeredCorrectly ? 'answered good' : ''}${answeredWrongly ? ' answered bad' : ''}">
        <div class="mock-phone">
          <div class="mock-status"><span>10:${15 + index * 7}</span><span>4G</span></div>
            <div class="mock-appbar">${escapeHtml(t(item.app === 'whatsapp' ? 'appWhatsApp' : item.app === 'popup' ? 'appBrowser' : 'appInstagramDm'))}</div>
          <div class="mock-screen-body">
            <small>${escapeHtml(item.from)}</small>
            <p>${escapeHtml(item.message)}</p>
          </div>
        </div>
        <div class="classify-actions">
          <button type="button" class="${realResultClass}${realEffectClass}" data-classify="${index}" data-value="real" ${picked ? 'disabled' : ''}>${escapeHtml(t('realButton'))}</button>
          <button type="button" class="${scamResultClass}${scamEffectClass}" data-classify="${index}" data-value="scam" ${picked ? 'disabled' : ''}>${escapeHtml(t('scamButton'))}</button>
        </div>
      </article>
    `;
  }).join('');

  ui.host.innerHTML = `
    <section class="scam-game activity-stage ${state.reaction === 'bad' ? 'is-wrong' : ''}">
      <div class="activity-panel ${state.reaction}">
        <div class="activity-prompt">${escapeHtml(activity.instruction)}</div>
        <div class="classify-grid">${items}</div>
      </div>
    </section>
  `;

  ui.host.querySelectorAll('[data-classify]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.classifications[button.dataset.classify]) return;
      state.classifications[button.dataset.classify] = button.dataset.value;
      const item = activity.items[Number(button.dataset.classify)];
      const effectKey = `classify:${button.dataset.classify}:${button.dataset.value}`;
      speakPrompt(activity.instruction, activity.speechAudio?.instruction);
      if (button.dataset.value === item.answer) {
        if (isActivityCorrect(activity)) {
          setFeedback(`${t('correct')} ${activity.coach}`, 'good', effectKey, activity.speechAudio?.completeFeedback);
        } else {
          setFeedback(item.flag, 'good', effectKey);
        }
      } else {
        setFeedback(getItemWrongFeedback(item, activity), 'bad', effectKey);
      }
      renderGame();
    });
  });
}

function renderFeedback() {
  if (!state.feedback) return '';
  return `<div class="activity-feedback ${state.feedback.includes('Correct') ? 'good' : 'bad'}">${escapeHtml(state.feedback)}</div>`;
}

function checkActivity() {
  const activity = getCurrentActivity();
  let correct = false;

  if (activity.type === 'single') {
    correct = state.selected.has(activity.correct);
  } else if (activity.type === 'multi') {
    correct = activity.correct.length === state.selected.size && activity.correct.every((index) => state.selected.has(index));
  } else {
    correct = activity.items.every((item, index) => state.classifications[index] === item.answer);
  }

  const hasAnswer = activity.type === 'classify'
    ? Object.keys(state.classifications).length === activity.items.length
    : state.selected.size > 0;

  if (!hasAnswer) {
    showToast(t('chooseAnswer'));
    return;
  }

  state.feedback = correct ? `${t('correct')} ${activity.coach}` : getActivityWrongFeedback(activity);
  if (!correct) speakFeedbackMessage(state.feedback);
  renderGame();
}

function updateChrome() {
  const scene = scenes[state.sceneIndex] || scenes[0];
  const activity = getCurrentActivity();
  const isMythFact = state.phase === 'activity' && activity.type === 'mythFact';
  document.title = t('appTitle');
  document.documentElement.lang = currentLanguage;
  if (ui.moduleLabel) ui.moduleLabel.textContent = t('moduleLabel');
  ui.title.textContent = isMythFact ? t('mythTitle') : state.phase === 'activity' ? activity.title : t('title');
  ui.subtitle.textContent = state.phase === 'intro'
    ? t('subtitle')
    : isMythFact
      ? t('mythSubtitle')
      : state.phase === 'activity'
        ? activity.instruction
        : scene.title;
  if (state.phase === 'activity' && activity.id === 'activity-1') {
    if (ui.moduleLabel) ui.moduleLabel.textContent = '';
    ui.title.textContent = 'Scam Safety Words';
    ui.subtitle.hidden = false;
    ui.subtitle.innerHTML = 'Tap each vocabulary card to open it.';
    ui.coachEyebrow.textContent = 'Your Goal';
    document.querySelector('.safety-coach-list').innerHTML = `
      <span class="coach-icon target-icon" aria-hidden="true"></span><strong>Listen to the meaning and learn the warning signs.</strong>
    `;
    const recap = document.getElementById('recapSideCard');
    if (recap) {
      recap.hidden = false;
      recap.innerHTML = `
        <div class="section-eyebrow what-do-title">What You'll Do</div>
        <div class="safety-coach-list key-do-list">
          <span class="coach-icon read-icon" aria-hidden="true"></span><strong>Read each word</strong>
          <span class="coach-icon listen-icon" aria-hidden="true"></span><strong>Listen to the meaning</strong>
          <span class="coach-icon alert-icon" aria-hidden="true"></span><strong>Understand the warning signs</strong>
        </div>
      `;
    }
  } else {
    document.querySelector('.safety-coach-list').innerHTML = `
      <span class="coach-icon alert-icon" aria-hidden="true"></span><strong>Stay alert</strong>
      <span class="coach-icon check-icon" aria-hidden="true"></span><strong>Check what feels unusual</strong>
      <span class="coach-icon wise-icon" aria-hidden="true"></span><strong>Choose wisely</strong>
    `;
    const recap = document.getElementById('recapSideCard');
    if (recap) recap.hidden = true;
  }
  if (!(state.phase === 'activity' && activity.id === 'activity-1')) ui.coachEyebrow.textContent = t('coachTitle');
  const activityCoach = isMythFact
    ? t('mythCoach')
    : activity.type === 'quizSet'
      ? t('quizCoach')
      : `${activity.coach} ${t('tried')}`;
  ui.coach.textContent = state.phase === 'activity' ? activityCoach : t('coach');
  if (ui.feedbackCard && ui.feedbackText) {
    ui.feedbackCard.hidden = !state.feedback || (state.phase === 'activity' && activity.id === 'activity-1');
    ui.feedbackText.textContent = state.feedback;
    ui.feedbackCard.classList.toggle('feedback-good', state.feedbackKind === 'good');
    ui.feedbackCard.classList.toggle('feedback-bad', state.feedbackKind === 'bad');
  }
  ui.canvasTitle.textContent = isMythFact ? t('mythStage') : state.phase === 'activity' ? t('activityCanvas') : t('boardTitle');
  if (state.phase === 'activity' && activity.id === 'activity-1') {
    ui.canvasTitle.textContent = t('bubbleArena');
  } else if (state.phase === 'activity' && activity.id === 'q3-pay-first') {
    ui.canvasTitle.textContent = t('sortArena');
  }
  ui.sideProgress.hidden = state.phase === 'intro';
  ui.sideProgress.textContent = state.phase === 'intro'
    ? ''
    : isMythFact
      ? t('countOf', { current: state.mythIndex + 1, total: activity.myths.length })
      : t('stepPoints', { step: Math.max(state.step, 1), total: GAME_STEPS, points: state.points });
  updateStaticText();
  updateProgressDots();
}

function renderGame() {
  updateChrome();

  if (state.phase === 'intro') {
    ui.host.innerHTML = `
      <section class="scam-game intro-stage">
        <div class="intro-copy">
          <span>${escapeHtml(t('introKicker'))}</span>
          <h3>${escapeHtml(t('introTitle'))}</h3>
          <p>${escapeHtml(t('introBody'))}</p>
        </div>
        <div class="cast-row">
          ${Object.values(characters).map((person) => `
            <div class="cast-card">
              <img src="${person.image}" alt="${person.name}">
              <strong>${person.name}</strong>
            </div>
          `).join('')}
        </div>
      </section>
    `;
    setFooterButtons([{ label: t('start'), onClick: () => startScene(0) }]);
    return;
  }

  if (state.phase === 'scene') {
    const scene = scenes[state.sceneIndex];
    renderScene(scene);
    const complete = state.preludeDone && state.revealedLineCount >= scene.lines.length && !state.speaking;
    setFooterButtons([
      { label: complete ? t('activity') : t('sceneLocked'), disabled: !complete, onClick: goToActivity }
    ]);
    return;
  }

  if (state.phase === 'activity') {
    const activity = getCurrentActivity();
    renderActivity(activity);
    if (activity.type === 'quizSet') {
      const questions = getQuizFrameQuestions(activity);
      const isLastQuestion = state.quizQuestionIndex >= questions.length - 1;
      setFooterButtons([
        { label: isLastQuestion ? t('continue') : t('continue'), disabled: !hasActivityAttempt(activity), onClick: goToNextQuizFrame }
      ]);
      return;
    }
    if (activity.type === 'mythFact') {
      const isLastMyth = state.mythIndex >= activity.myths.length - 1;
      setFooterButtons([
        { label: isLastMyth ? t('continue') : t('nextMyth'), disabled: !hasActivityAttempt(activity), onClick: goToNextMythFrame }
      ]);
      return;
    }
    if (activity.id === 'activity-1' && isActivityCorrect(activity)) {
      setFooterButtons([{ label: t('playAgain'), onClick: restartGame }]);
      return;
    }
    setFooterButtons([
      {
        label: t('continue'),
        disabled: activity.id === 'activity-1' ? true : !hasActivityAttempt(activity),
        onClick: goNextActivityOrScene
      }
    ]);
    return;
  }

  const spottedClues = [
    ['gift', 'Big Prize', 'Too good to be true'],
    ['alarm', 'Hurry', 'They rush you'],
    ['money', 'Pay First', 'Never pay to claim prizes'],
    ['phone', 'Unknown Sender', "Don't trust unknown people"],
    ['chain', 'Suspicious Link', 'Short links can be risky'],
    ['guarantee', 'Guaranteed Claims', 'No one can guarantee this']
  ];
  const confetti = Array.from({ length: 34 }, (_, index) => `
    <i class="final-confetti${index % 5 === 0 ? ' confetti-star' : ''}"
      style="--x:${(index * 29) % 98}%; --delay:${(index % 9) * -0.38}s; --dur:${3.3 + (index % 6) * 0.34}s; --spin:${80 + (index % 7) * 54}deg;"></i>
  `).join('');
  ui.host.innerHTML = `
    <section class="scam-game complete-stage final-mission-stage">
      <div class="final-confetti-layer" aria-hidden="true">${confetti}</div>
      <aside class="final-side-panel">
        <section class="final-side-mission-card">
          <img src="./assets/pictures/bubble-icons/shield.webp" alt="">
          <strong>Mission<br><em>Complete!</em></strong>
          <span>You are awesome!</span>
        </section>
        <section class="final-found-card">
          <span class="final-target-icon" aria-hidden="true">&#127919;</span>
          <div>
            <strong>Found</strong>
            <b>6 / 6</b>
            <span>Red Flags</span>
          </div>
        </section>
        <div class="sidebar-motto"><span aria-hidden="true"></span> Be <b>Smart.</b> Be <b>Safe.</b> Be <b>Secure.</b></div>
      </aside>
      <main class="final-board">
        <header class="final-heading">
          <h3><span>You</span> <em>Saved</em> <span>Zara!</span></h3>
          <p>You spotted all the scam tricks and kept yourself and your friends safe.</p>
        </header>
        <div class="final-hero-row">
          <img class="final-zara" src="./assets/ui/mascot.webp" alt="Zara holding a phone and giving a thumbs up">
          <img class="final-shield" src="./assets/pictures/final badge.webp" alt="Safety shield badge">
          <img class="final-scam-trash" src="./assets/pictures/final-assets/scam-trash.webp" alt="Scam message thrown in the trash">
        </div>
        <section class="final-spotted-panel">
          <strong class="final-spotted-ribbon">You spotted:</strong>
          <div class="final-spotted-grid">
            ${spottedClues.map(([icon, title, detail]) => `
              <article class="final-clue-card">
                <img src="./assets/pictures/bubble-icons/${icon}.webp" alt="">
                <strong>${title}</strong>
                <span>${detail}</span>
              </article>
            `).join('')}
          </div>
        </section>
        <button class="final-play-again" type="button">&#8635; <span>${escapeHtml(t('playAgain'))}</span></button>
      </main>
    </section>
  `;
  ui.coach.textContent = t('complete');
  setFooterButtons([]);
  ui.host.querySelector('.final-play-again').addEventListener('click', restartGame);
}

function updateStaticText() {
  document.querySelector('[data-i18n="rotateTitle"]').textContent = t('rotateTitle');
  document.querySelector('[data-i18n="rotateMessage"]').textContent = t('rotateMessage');
  updateTutorialText();
  syncMuteIconState();
  syncFullscreenState();
}

function getTutorialContent(activity = null) {
  const activeActivity = activity || activities.find((item) => item.id === state.tutorialActivityId);
  const tutorial = activeActivity?.tutorial || {};
  return {
    title: tutorial.title || t('tutorialTitle'),
    steps: [
      tutorial.steps?.[0] || t('tutorialStep1'),
      tutorial.steps?.[1] || t('tutorialStep2'),
      tutorial.steps?.[2] || t('tutorialStep3'),
      tutorial.steps?.[3] || t('tutorialStep4')
    ]
  };
}

function updateTutorialText(activity = null) {
  const tutorial = getTutorialContent(activity);
  document.getElementById('tutorialTitle').textContent = tutorial.title;
  tutorial.steps.forEach((step, index) => {
    document.getElementById(`tutorialStep${index + 1}`).textContent = step;
  });
}

function showTutorial(activity = null) {
  if (activity?.id) state.tutorialActivityId = activity.id;
  updateTutorialText(activity);
  if (ui.tutorialOverlay) {
    ui.tutorialOverlay.style.display = 'flex';
  }
}

function hideTutorial() {
  if (ui.tutorialOverlay) {
    ui.tutorialOverlay.style.display = 'none';
  }
  if (state.phase === 'activity' && state.tutorialPrompt) {
    const prompt = state.tutorialPrompt;
    state.tutorialPrompt = '';
    speakPrompt(prompt, getCurrentActivity()?.speechAudio?.instruction);
  }
}

function setupTutorial() {
  document.getElementById('openTutorialBtn').addEventListener('click', showTutorial);
  document.getElementById('closeTutorialBtn').addEventListener('click', () => {
    hideTutorial();
  });
  ui.tutorialOverlay.addEventListener('click', (event) => {
    if (event.target === ui.tutorialOverlay) hideTutorial();
  });
}

function setupLanguageSwitcher() {
  const overlay = document.getElementById('languagePopupOverlay');
  const trigger = document.getElementById('customSelectTrigger');
  const selectedText = document.getElementById('selectedLangText');
  const options = document.getElementById('customSelectOptions');
  const applyBtn = document.getElementById('langApplyBtn');
  const cancelBtn = document.getElementById('langCancelBtn');
  const closeBtn = document.getElementById('langPopupCloseBtn');
  const mainPanel = document.getElementById('langMainPanel');
  const confirmPanel = document.getElementById('langConfirmPanel');
  const popup = document.getElementById('languagePopup');
  let pendingLanguage = currentLanguage;

  const toggleDropdown = (open) => {
    const nextOpen = typeof open === 'boolean' ? open : !trigger.classList.contains('open');
    trigger.classList.toggle('open', nextOpen);
    options.classList.toggle('open', nextOpen);
    trigger.setAttribute('aria-expanded', String(nextOpen));
  };

  const populateOptions = () => {
    options.innerHTML = '';
    selectedText.textContent = supportedLanguages[pendingLanguage] || supportedLanguages.en;
    Object.entries(supportedLanguages).forEach(([code, name]) => {
      const option = document.createElement('div');
      option.className = 'custom-select-option';
      option.dataset.lang = code;
      option.textContent = name;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(code === pendingLanguage));
      option.classList.toggle('selected', code === pendingLanguage);
      option.addEventListener('click', () => {
        pendingLanguage = code;
        selectedText.textContent = name;
        applyBtn.disabled = pendingLanguage === currentLanguage;
        populateOptions();
        toggleDropdown(false);
      });
      options.appendChild(option);
    });
  };

  const closePopup = () => {
    popup.classList.remove('confirm-only');
    toggleDropdown(false);
    overlay.style.display = 'none';
  };

  ui.langBtn.addEventListener('click', () => {
    pendingLanguage = currentLanguage;
    applyBtn.disabled = true;
    mainPanel.hidden = false;
    confirmPanel.hidden = true;
    confirmPanel.classList.remove('show');
    popup.classList.remove('confirm-only');
    populateOptions();
    overlay.style.display = 'flex';
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleDropdown();
  });
  cancelBtn.addEventListener('click', closePopup);
  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePopup();
  });
  applyBtn.addEventListener('click', () => {
    if (pendingLanguage === currentLanguage) {
      overlay.style.display = 'none';
      return;
    }
    if (typeof stopCurrentAudio === 'function') stopCurrentAudio();
    if (typeof cancelVoice === 'function') cancelVoice();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentLanguage = pendingLanguage;
    applyLocaleContent();
    localStorage.setItem('digital_safety_language', currentLanguage);
    renderGame();
    document.getElementById('langSelectedMessageStart').textContent = t('languageSelectedStart', {
      language: supportedLanguages[currentLanguage]
    });
    mainPanel.hidden = true;
    confirmPanel.hidden = false;
    confirmPanel.classList.add('show');
    popup.classList.add('confirm-only');
    window.setTimeout(closePopup, 2000);
  });
}

function syncMuteIconState() {
  const onIcon = ui.muteBtn.querySelector('.mute-on-icon');
  const offIcon = ui.muteBtn.querySelector('.mute-off-icon');
  ui.muteBtn.classList.toggle('is-muted', state.muted);
  ui.muteBtn.title = state.muted ? t('muted') : t('unmuted');
  ui.muteBtn.setAttribute('aria-label', state.muted ? t('muted') : t('unmuted'));
  if (onIcon) onIcon.style.display = state.muted ? 'none' : 'block';
  if (offIcon) offIcon.style.display = state.muted ? 'block' : 'none';
}

function syncFullscreenState() {
  const btn = document.getElementById('fullscreenBtn');
  const enterIcon = btn.querySelector('.fullscreen-enter-icon');
  const exitIcon = btn.querySelector('.fullscreen-exit-icon');
  const active = Boolean(document.fullscreenElement);
  document.body.classList.toggle('is-browser-fullscreen', active);
  btn.classList.toggle('is-fullscreen', active);
  btn.title = active ? t('exitFullscreen') : t('enterFullscreen');
  btn.setAttribute('aria-label', active ? t('exitFullscreen') : t('enterFullscreen'));
  if (enterIcon) enterIcon.style.display = active ? 'none' : 'block';
  if (exitIcon) exitIcon.style.display = active ? 'block' : 'none';
}

function setupControls() {
  ui.muteBtn.addEventListener('click', () => {
    // Play the button-press click as feedback (audible whether turning sound on or off).
    buttonClickSound.currentTime = 0;
    buttonClickSound.play().catch(() => {});
    // Mute only changes volume: any playing audio keeps going at volume 0,
    // and unmute restores it to the system level. Audio is never cut off.
    state.muted = !state.muted;
    applyAudioMute();
    syncMuteIconState();
  });
  document.getElementById('resetGameBtn').addEventListener('click', restartGame);
  document.getElementById('fullscreenBtn').addEventListener('click', async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    } else {
      const requestFullscreen = document.documentElement.requestFullscreen?.bind(document.documentElement);
      if (requestFullscreen) {
        try {
          await requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await requestFullscreen();
        }
      }
    }
    syncFullscreenState();
  });
  document.addEventListener('fullscreenchange', syncFullscreenState);
}

async function initialize() {
  const savedLanguage = localStorage.getItem('digital_safety_language');
  if (savedLanguage && supportedLanguages[savedLanguage]) {
    currentLanguage = savedLanguage;
  }
  await loadLocaleContent();
  buildProgressDots();
  setupControls();
  setupTutorial();
  refreshVoices();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
  renderGame();
  const initialActivity = getCurrentActivity();
  state.tutorialPrompt = initialActivity?.instruction || '';
  activateStartupGate(() => {
    playFirstPageInstruction();
  });
}

window.addEventListener('beforeunload', cancelVoice);
window.addEventListener('load', initialize);
