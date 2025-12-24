function diffObjects(before, after) {
  const changes = {};
  Object.keys(after).forEach((key) => {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  });
  return changes;
}

module.exports = { diffObjects };

