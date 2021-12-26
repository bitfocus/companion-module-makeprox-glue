const io = require('socket.io-client')
const instance_skel = require('../../instance_skel')

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)
		this.widgetStates = {};
		this.feedbacksAndPresetsLoaded = false;
	}

	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Use this module to trigger functions in Glue by companion. If you want communication in the other way (control Companion by Glue), use Glue\'s "Companion Satellite Feature" instead.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Glue Host / IP',
				width: 6,
				regex: this.REGEX_SOMETHING,
			},
		]
	}

	destroy() {
		if (this.socket !== undefined) {
			this.socket.close()
		}
	}

	init() {
		this.initSocketConnection()
	}

	updateActions() {
		let actions = {}
		const choices = [];
		for (let widgetIdx = 0; widgetIdx < this.widgetStates.length; widgetIdx++) {
			const id = this.getItemId(widgetIdx)
			const label = this.getItemLabel(widgetIdx)
			choices.push({ id, label })
		}
		actions["button"] = {
			label: "Trigger Button",
			options: [
				{
					type: 'dropdown',
					label: 'Widget',
					id: 'widget',
					choices,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'action',
					choices: [
						{ id: "PRESS", label: "Press" },
						{ id: "RELEASE", label: "Release" },
						{ id: "TOGGLE", label: "Toggle (Press and Release)" },
					],
					default: 'TOGGLE',
				},
			],
			callback: (action, bank) => {
				if (this.socket) {
					const widgetIdx = this.getWidgetIdxFromItemId(action);
					this.debug(`Sending ${action.options.action} command for widget #${widgetIdx}`);
					this.socket.emit("widgetState", widgetIdx, action.options.action)
				}
			},
		}


		this.setActions(actions)
	}

	getWidgetIdxFromItemId(action) {
		return parseInt((action.options.widget || "").replace("widget-", ""));
	}

	getItemShortLabel(widgetIdx) {
		return `Widget ${Math.floor(widgetIdx / 4) + 1}.${(widgetIdx % 4) + 1}`;
	}

	getItemLabel(widgetIdx) {
		return `${this.getItemShortLabel(widgetIdx)}: ${this.widgetStates[widgetIdx].label || "n/a"} (${this.widgetStates[widgetIdx].context || "n/a"})`;
	}

	getItemId(widgetIdx) {
		return `widget-${widgetIdx}`;
	}

	updateFeedbacks() {
		let feedbacks = {}
		const choices = [];
		for (let widgetIdx = 0; widgetIdx < this.widgetStates.length; widgetIdx++) {
			const id = this.getItemId(widgetIdx)
			const label = this.getItemLabel(widgetIdx)
			choices.push({ id, label })
		}
		feedbacks["button"] = {
			type: 'advanced',
			label: "Button Feedback",
			description: `Feedback for a Button`,
			options: [
				{
					type: 'dropdown',
					label: 'Widget',
					id: 'widget',
					choices,
				},
			],
			callback: (feedback) => {
				const widgetIdx = this.getWidgetIdxFromItemId(feedback);
				return {
					bgcolor: parseInt((this.widgetStates[widgetIdx].color || "#000000").replace("#", "0x"), 16),
					text: this.widgetStates[widgetIdx].label,
				}
			}
		}
		this.setFeedbackDefinitions(feedbacks)

		const presets = [];
		for (let widgetIdx = 0; widgetIdx < this.widgetStates.length; widgetIdx++) {
			presets.push({
				category: 'Buttons',
				label: this.getItemShortLabel(widgetIdx),
				bank: {
					style: 'text',
					text: this.getItemShortLabel(widgetIdx),
					size: 'auto',
					color: '16777215',
					bgcolor: this.rgb(0,0,0),
				},
				actions: [
					{
						action: 'button',
						options: {
							widget: this.getItemId(widgetIdx),
						}
					}
				],
				feedbacks: [
					{
						type: "button",
						options: {
							widget: this.getItemId(widgetIdx),
						}
					}
				]
			});
		}
		this.setPresetDefinitions(presets);
	}

	initSocketConnection() {
		if (this.socket !== undefined) {
			this.socket.close()
			delete this.socket
		}

		if (this.config.host) {
			this.status(this.STATUS_WARNING, 'Connecting...')
			this.socket = io(`http://${this.config.host}:${49013}`)

			this.socket.on('connect', () => {
				this.status(this.STATUS_OK, 'Connected successfully')
				this.feedbacksAndPresetsLoaded = false;
			})

			this.socket.on('disconnect', () => {
				this.status(this.STATUS_ERROR, 'Disconnected.')
			})

			this.socket.on("widgetState", (widgetStates) => {
				this.widgetStates = widgetStates;
				if (!this.feedbacksAndPresetsLoaded) {
					this.updateFeedbacks()
					this.feedbacksAndPresetsLoaded = true;
				}
				this.updateActions();
				this.checkFeedbacks("button")
			})
		} else {
			this.status(this.STATUS_ERROR, 'No host specified.')
		}
	}

	updateConfig(config) {
		let resetConnection = false

		if (this.config.host != config.host) {
			resetConnection = true
		}

		this.config = config

		if (resetConnection === true || this.socket === undefined) {
			this.initSocketConnection()
		}
	}
}

exports = module.exports = instance
