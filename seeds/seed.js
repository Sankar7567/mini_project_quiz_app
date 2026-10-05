'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const Domain = require('../models/Domain');
const Question = require('../models/Question');
const { domains, questionsData } = require('./quizData');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/quizapp';

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅  Connected to MongoDB for seeding');

    // Clear existing data
    await Question.deleteMany({});
    await Domain.deleteMany({});
    console.log('🗑️   Cleared existing domains and questions');

    // Insert domains
    const createdDomains = [];
    for (const domainData of domains) {
      const domain = new Domain(domainData);
      await domain.save();
      createdDomains.push(domain);
      console.log(`📂  Created domain: ${domain.name}`);
    }

    // Build a name → domain map
    const domainMap = {};
    createdDomains.forEach((d) => {
      domainMap[d.name] = d;
    });

    // Insert questions for each domain
    let totalQuestions = 0;
    for (const [domainName, questions] of Object.entries(questionsData)) {
      const domain = domainMap[domainName];
      if (!domain) {
        console.warn(`⚠️   Domain "${domainName}" not found, skipping`);
        continue;
      }

      const questionDocs = questions.map((q) => ({
        domainId: domain._id,
        ...q,
      }));

      await Question.insertMany(questionDocs);
      totalQuestions += questionDocs.length;
      console.log(
        `❓  Inserted ${questionDocs.length} questions for "${domainName}"`
      );
    }

    console.log(`\n🎉  Seeding complete!`);
    console.log(`    Domains:   ${createdDomains.length}`);
    console.log(`    Questions: ${totalQuestions}`);
    process.exit(0);
  } catch (err) {
    console.error('❌  Seeding failed:', err.message);
    process.exit(1);
  }
};

seed();
