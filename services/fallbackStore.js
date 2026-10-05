'use strict';

const mongoose = require('mongoose');
const { domains: rawDomains, questionsData } = require('../seeds/quizData');

// Generate 24-character hex strings for deterministic ObjectIds in offline mode
const makeObjectId = (num) => num.toString(16).padStart(24, '0');

const mockDomains = rawDomains.map((d, index) => {
  const id = makeObjectId(index + 1);
  return {
    _id: id,
    ...d,
    slug: d.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim(),
    isActive: true,
  };
});

const mockDomainMap = {};
mockDomains.forEach((d) => {
  mockDomainMap[d._id] = d;
  mockDomainMap[d.name] = d;
});

let questionCounter = 1;
const mockQuestions = [];
const mockQuestionMap = {};

for (const [domainName, questions] of Object.entries(questionsData)) {
  const domain = mockDomainMap[domainName];
  if (!domain) continue;

  questions.forEach((q) => {
    const qId = makeObjectId(1000 + questionCounter++);
    const questionObj = {
      _id: qId,
      domainId: domain._id,
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'Medium',
      points: q.points || 1,
      isActive: true,
    };
    mockQuestions.push(questionObj);
    mockQuestionMap[qId] = questionObj;
  });
}

const mockAttempts = [];

module.exports = {
  isOffline: () => mongoose.connection.readyState !== 1,
  makeObjectId,
  mockDomains,
  mockDomainMap,
  mockQuestions,
  mockQuestionMap,
  mockAttempts,
};
