//
// Flow Model
//

define([], function () {
	return Em.Object.extend({
		metricData: null,
		metricNames: null,
		__loadingData: false,
		instances: 0,
		init: function() {
			this._super();

			this.set('metricData', Em.Object.create());
			this.set('metricNames', {});

			this.set('id', this.get('flowId') || this.get('meta').name);
			this.set('app', this.get('applicationId') || this.get('meta').app);

		},
		addMetricName: function (name) {

			this.get('metricNames')[name] = 1;

		},
		getUpdateRequest: function () {

			if (this.get('currentState') !== 'RUNNING') {
				return [];
			}

			var self = this;

			var app = this.get('app'),
				id = this.get('id'),
				end = Math.round(new Date().getTime() / 1000),
				start = end - C.__timeRange;

			var metrics = [];
			var metricNames = this.get('metricNames');
			for (var name in metricNames) {
				if (metricNames[name] === 1) {
					metrics.push(name);
				}
			}
			if (!metrics.length) {
				C.debug('Cannot update. Not tracking any metrics for ' + app + ':' + id);
				this.set('__loadingData', false);
				return;
			}

			return ['monitor', {
				method: 'getTimeSeries',
				params: [app, id, metrics, start, end, 'FLOW_LEVEL']
			}, function (error, response) {

				if (!response.params) {
					return;
				}

				var data, points = response.params.points,
					latest = response.params.latest;

				for (var metric in points) {
					data = points[metric];

					var k = data.length;
					while(k --) {
						data[k] = data[k].value;
					}

					/*
					var a = 0;
					data = data.splice(0, C.__timeRange);
					for (var k = data.length; k < C.__timeRange; k++) {
						data.unshift(0);
						a ++;
					}
					*/

					metric = metric.replace(/\./g, '');
					self.get('metricData').set(metric, data);
					this.set('__loadingData', false);
				}

			}];

		},
		href: function () {
			if (this.get('applicationId')) {
				return '#/flows/status/' + this.get('applicationId') + ':' + this.get('flowId');
			} else {
				return '#/flows/status/' + this.get('meta').app + ':' + this.get('meta').name;
			}
		}.property(),
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
});
