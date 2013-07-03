/*
 * Batch Model
 */

define(['lib/date'], function (Datejs) {

  var Model = Em.Object.extend({

    href: function () {
      return '#/batches/' + this.get('id');
    }.property('id'),
    metricData: null,
    metricNames: null,
    __loadingData: false,
    instances: 0,
    type: 'Batch',
    plural: 'Batches',
    startTime: null,
    alertCount: 0,

    init: function() {
      this._super();

      this.set('timeseries', Em.Object.create());
      this.set('aggregates', Em.Object.create());

      this.set('name', (this.get('flowId') || this.get('id') || this.get('meta').name));

      this.set('app', this.get('applicationId') || this.get('application'));
      this.set('id', this.get('app') + ':' +
        (this.get('flowId') || this.get('id') || this.get('meta').name));
      if (this.get('meta')) {
        this.set('startTime', this.get('meta').startTime);
      }
    },

    getStartDate: function() {
      var time = parseInt(this.get('startTime'), 10);
      return new Date(time).toString('MMM d, yyyy');
    }.property('startTime'),

    getStartHours: function() {
      var time = parseInt(this.get('startTime'), 10);
      return new Date(time).toString('hh:mm tt');
    }.property('startTime'),

    units: {
      'mapperRecords': 'number',
      'mapperBytes': 'bytes',
      'reducerRecords': 'number',
      'reducerBytes': 'bytes'
    },

    trackMetric: function (name, type, label) {

      name = name.replace(/{parent}/, this.get('app'));
      name = name.replace(/{id}/, this.get('name'));

      this.get(type)[name] = label;

      return name;

    },

    setMetric: function (label, value) {

      var unit = this.get('units')[label];
      value = C.Util[unit](value);

      this.set(label + 'Label', value[0]);
      this.set(label + 'Units', value[1]);

    },

    updateState: function (http) {

      var self = this;

      var app_id = this.get('app'),
        flow_id = this.get('name');

      http.rpc('runnable', 'status', [app_id, flow_id, -1],
        function (response) {

          if (response.result) {
            self.set('currentState', response.result.status);
          }

      });

    },

    /*
    getMetricsRequest: function() {

      // These placeholders names are for Handlebars to render the associated metrics.
      var placeholderNames = {
        '/store/bytes/datasets/dataset1?total=true': 'input1',
        '/store/records/datasets/dataset1?total=true': 'input2',
        '/process/events/jobs/mappers/job1?total=true': 'mappers1',
        '/process/bytes/jobs/mappers/job1?total=true': 'mappers2',
        '/process/events/jobs/reducers/job1?total=true': 'reducers1',
        '/process/bytes/jobs/reducers/job1?total=true': 'reducers2',
        '/store/bytes/datasets/dataset2?total=true': 'output1',
        '/store/records/datasets/dataset2?total=true': 'output2'
      };

      var paths = [];
      for (var path in placeholderNames) {
        paths.push(path);
      }

      var self = this;

      return ['metrics', paths, function(result, status) {

        if(!result) {
          return;
        }

        var i = result.length, metric;
        while (i--) {
          metric = placeholderNames[paths[i]];
          self.setMetricData(metric, result[i]);
        }

      }];

    },

    getAlertsRequest: function() {
      var self = this;

      return ['batch/SampleApplicationId:batchid1?data=alerts', function(status, result) {
        if(!result) {
          return;
        }

        self.set('alertCount', result.length);
      }];

    },
    */

    getMeta: function () {
      var arr = [];
      for (var m in this.meta) {
        arr.push({
          k: m,
          v: this.meta[m]
        });
      }
      return arr;
    }.property('meta'),
    isRunning: function() {

      return this.get('currentState') === 'RUNNING';

    }.property('currentState'),
    started: function () {
      return this.lastStarted >= 0 ? $.timeago(this.lastStarted) : 'No Date';
    }.property('timeTrigger'),
    stopped: function () {
      return this.lastStopped >= 0 ? $.timeago(this.lastStopped) : 'No Date';
    }.property('timeTrigger'),
    actionIcon: function () {

      if (this.currentState === 'RUNNING' ||
        this.currentState === 'PAUSING') {
        return 'btn-pause';
      } else {
        return 'btn-start';
      }

    }.property('currentState').cacheable(false),
    stopDisabled: function () {

      if (this.currentState === 'RUNNING') {
        return false;
      }
      return true;

    }.property('currentState'),
    startPauseDisabled: function () {

      if (this.currentState !== 'STOPPED' &&
        this.currentState !== 'PAUSED' &&
        this.currentState !== 'DEPLOYED' &&
        this.currentState !== 'RUNNING') {
        return true;
      }
      return false;

    }.property('currentState'),
    defaultAction: function () {
      return {
        'deployed': 'Start',
        'stopped': 'Start',
        'stopping': 'Start',
        'starting': 'Start',
        'running': 'Pause',
        'adjusting': '...',
        'draining': '...',
        'failed': 'Start'
      }[this.currentState.toLowerCase()];
    }.property('currentState')
  });

  Model.reopenClass({
    type: 'Batch',
    kind: 'Model',
    find: function(model_id, http) {
      var promise = Ember.Deferred.create();

      var model_id = model_id.split(':');
      var app_id = model_id[0];
      var mapreduce_id = model_id[1];

      http.rest('apps', app_id, 'mapreduce', mapreduce_id, function (model, error) {

        model = C.Batch.create(model);

        http.rpc('runnable', 'status', [app_id, mapreduce_id, -1],
          function (response) {

            if (response.error) {
              promise.reject(response.error);
            } else {
              model.set('currentState', response.result.status);
              promise.resolve(model);
            }

        });

      });

      return promise;

    }
  });

  return Model;

});
