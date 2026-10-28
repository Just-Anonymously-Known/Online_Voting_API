
const test = require('node:test');
const assert = require('node:assert/strict');

test('election controller exports its required handlers', () => {
  const controller = require('../controllers/electionController');

  assert.equal(typeof controller.createElection, 'function');
  assert.equal(typeof controller.getElections, 'function');
  assert.equal(typeof controller.getElectionById, 'function');
  assert.equal(typeof controller.updateElectionStatus, 'function');
});

test('vote controller exports castVote', () => {
  const controller = require('../controllers/voteController');

  assert.equal(typeof controller.castVote, 'function');
});
