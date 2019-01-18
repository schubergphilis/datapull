module.exports = function (records, callback) {
  var batches = [];

  var currentBatch = [];
  var currentBatchMessagesLength = 0;

  records.forEach(function (record) {
    if (!record.Data) {
      console.warn("WARNING, message should be wrapped in 'Data' field");
      return;
    }

    if (!record.PartitionKey) {
      console.warn("WARNING, message should have a 'PartitionKey' field");
      return;
    }

    if (record.Data.length >= 1000 * 1000) {
      console.error("WARNING, the message size exceeds 1000kb, cannot be sent to Kinesis", record.Data.length, record._meta);
      return;
    }

    currentBatch.push(record);
    currentBatchMessagesLength += record.Data.length + record.PartitionKey.length;

    // no more than 500 records in every batch
    if (currentBatch.length >= 500) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchMessagesLength = 0;
    }

    // no more than 1mb in batch
    if (currentBatchMessagesLength >= 1 * 1024 * 1024) {
      var excessMessage = currentBatch.pop();
      batches.push(currentBatch);
      currentBatch = [excessMessage];
      currentBatchMessagesLength = excessMessage.Data.length;
    }

  });

  if (currentBatch.length) {
    batches.push(currentBatch);
  }

  callback(null, batches);
};
