export type PracticeItem = {
  id: string;
  japanese: string;
  intent: string;
  patternLabel: string;
  pattern: string;
  naturalEnglish: string;
  simpleEnglish: string;
  shortPhrase: string;
  stuckPoints: string[];
  nextReview: string;
};

export type ReviewItem = {
  id: string;
  japanese: string;
  lastAnswer: string;
  nextReview: string;
  weakPoint: string;
};

export type PracticeMode = {
  id: string;
  title: string;
  description: string;
  badge: string;
};

export const sampleDiaryText =
  '今日Jiveshにアプリの方向性を説明しないといけないけど、まだ具体案が固まってなくて焦ってる。英会話アプリっぽくはしたくない。日本語で考えたことを、すぐ英語で言えるようにしたい。';

export const practiceItems: PracticeItem[] = [
  {
    id: 'not-figured-out',
    japanese: 'まだ具体案が固まっていない',
    intent: '企画や考えが未整理な状態を説明したい',
    patternLabel: 'まだ〜が固まっていない',
    pattern: "I haven't figured out ... yet.",
    naturalEnglish: "I haven't figured out the concrete idea yet.",
    simpleEnglish: "I'm still trying to figure it out.",
    shortPhrase: 'Still figuring it out.',
    stuckPoints: ['figure out', 'concrete idea', 'yet の位置'],
    nextReview: '明日',
  },
  {
    id: 'explain-direction',
    japanese: '明日までに方向性を説明しないといけない',
    intent: '締切と説明責任を自然に言いたい',
    patternLabel: '〜までに説明する必要がある',
    pattern: 'I need to explain ... by tomorrow.',
    naturalEnglish: 'I need to explain the direction by tomorrow.',
    simpleEnglish: 'I have to explain where this is going by tomorrow.',
    shortPhrase: 'I need to explain the direction.',
    stuckPoints: ['direction', 'by tomorrow', 'have to / need to'],
    nextReview: '明日',
  },
  {
    id: 'not-conversation-app',
    japanese: '英会話アプリっぽくはしたくない',
    intent: '避けたい方向性をやわらかく伝えたい',
    patternLabel: '〜っぽくしたくない',
    pattern: "I don't want it to feel like ...",
    naturalEnglish: "I don't want it to feel like a typical conversation app.",
    simpleEnglish: "I don't want it to be just another chat app.",
    shortPhrase: 'Not just another chat app.',
    stuckPoints: ['feel like', 'typical', 'just another'],
    nextReview: '3日後',
  },
  {
    id: 'convert-faster',
    japanese: '日本語から英語への変換を速くしたい',
    intent: '学習目標を短く言いたい',
    patternLabel: '〜を速くできるようにしたい',
    pattern: 'I want to get faster at ...',
    naturalEnglish: 'I want to get faster at turning my Japanese thoughts into English.',
    simpleEnglish: 'I want to say my Japanese thoughts in English faster.',
    shortPhrase: 'Think in Japanese, say it in English.',
    stuckPoints: ['get faster at', 'turn A into B', 'thoughts'],
    nextReview: '明日',
  },
  {
    id: 'own-material',
    japanese: '自分の生活から英語の練習問題を作りたい',
    intent: 'アプリの強みを説明したい',
    patternLabel: '〜を教材にする',
    pattern: 'use ... as learning material',
    naturalEnglish: "I want to use the user's own daily life as learning material.",
    simpleEnglish: 'Your real life becomes your English practice.',
    shortPhrase: 'Your day becomes practice.',
    stuckPoints: ['learning material', "user's own", 'daily life'],
    nextReview: '1週間後',
  },
];

export const practiceModes: PracticeMode[] = [
  {
    id: 'instant',
    title: '瞬間英作文',
    description: '日本語カードを見て、10秒以内に英語で言う。',
    badge: '10秒',
  },
  {
    id: 'retry',
    title: '言い直し',
    description: '添削を見たあと、同じ文をもう一度声に出す。',
    badge: '2回目',
  },
  {
    id: 'reuse',
    title: '今日の再利用',
    description: '過去に詰まった文だけを、翌日以降に再出題する。',
    badge: '復習',
  },
];

export const reviewItems: ReviewItem[] = [
  {
    id: 'review-1',
    japanese: 'まだ具体案が固まっていない',
    lastAnswer: "I don't have the details yet.",
    nextReview: '今日',
    weakPoint: 'figure out を使う',
  },
  {
    id: 'review-2',
    japanese: '英会話アプリっぽくはしたくない',
    lastAnswer: "I don't want to make a conversation app.",
    nextReview: '今日',
    weakPoint: 'feel like で「〜っぽい」を言う',
  },
  {
    id: 'review-3',
    japanese: '自分の生活が教材になる',
    lastAnswer: 'My life is my material.',
    nextReview: '明日',
    weakPoint: 'learning material を自然に使う',
  },
];
