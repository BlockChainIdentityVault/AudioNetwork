// Copyright (c) 2015-2018 Robert Rypuła - https://audio-network.rypula.pl
(function () {
    'use strict';

    AudioNetwork.Injector
        .registerFactory('PhysicalLayer.PhysicalLayer', _PhysicalLayer);
    
    _PhysicalLayer.$inject = [
        'Common.QueueBuilder',
        'Common.MathUtil',
        'PhysicalLayer.DefaultConfig',
        'PhysicalLayer.ConfigurationParser',
        'PhysicalLayer.RxInput',
        'PhysicalLayer.RxHandlerBuilder',
        'PhysicalLayer.ChannelTransmitManagerBuilder',
        'PhysicalLayer.ChannelReceiveManagerBuilder',
        'Visualizer.ConstellationDiagramBuilder',
        'Visualizer.AnalyserChartBuilder',
        'Audio.ActiveAudioContext',
        'Common.SimplePromiseBuilder'
    ];

    function _PhysicalLayer(
        QueueBuilder,
        MathUtil,
        DefaultConfig,
        ConfigurationParser,
        RxInput,
        RxHandlerBuilder,
        ChannelTransmitManagerBuilder,
        ChannelReceiveManagerBuilder,
        ConstellationDiagramBuilder,
        AnalyserChartBuilder,
        ActiveAudioContext,
        SimplePromiseBuilder
    ) {
        var PhysicalLayer;

        PhysicalLayer = function (configuration) {
            this.$$configuration = ConfigurationParser.parse(configuration);
            this.$$channelTransmitManager = null;
            this.$$channelReceiveManager = null;
            this.$$currentInput = null;
            this.$$rxAnalyser = null;
            this.$$rxAnalyserChart = null;
            this.$$rxConstellationDiagram = [];

            this.$$outputTx = undefined;
            this.$$outputMicrophone = undefined;
            this.$$outputRecordedAudio = undefined;
            this.$$rxExternalHandler = {
                callback: null
            };
            this.$$rxHandler = RxHandlerBuilder.build(
                this.$$rxConstellationDiagram,
                this.$$rxExternalHandler
            );

            this.$$initTx();
            this.$$initRx();
            this.setRxInput(this.$$configuration.rx.input);
        };

        PhysicalLayer.prototype.$$initTx = function () {
            this.$$channelTransmitManager = ChannelTransmitManagerBuilder.build(
                this.$$configuration.tx.channel,
                this.$$configuration.tx.bufferSize
            );

            this.outputTxEnable();
            this.outputMicrophoneDisable();
            this.outputRecordedAudioDisable();
        };

        PhysicalLayer.prototype.$$initConstellationDiagram = function (channelIndex, channel) {
            var ofdmIndex, queue, constellationDiagram, elementId;

            queue = [];
            constellationDiagram = [];
            for (ofdmIndex = 0; ofdmIndex < channel.ofdmSize; ofdmIndex++) {
                elementId = this.$$configuration.rx.constellationDiagram.elementId;
                elementId = elementId.replace('{{ channelIndex }}', channelIndex + '');
                elementId = elementId.replace('{{ ofdmIndex }}', ofdmIndex + '');
                if (!document.getElementById(elementId)) {
                    throw 'Constellation diagram DOM element not found';
                }

                queue.push(
                    QueueBuilder.build(this.$$configuration.rx.constellationDiagram.historyPointSize)
                );
                constellationDiagram.push(
                    ConstellationDiagramBuilder.build(
                        document.getElementById(elementId),
                        this.$$configuration.rx.constellationDiagram.width,
                        this.$$configuration.rx.constellationDiagram.height,
                        queue[queue.length - 1],
                        DefaultConfig.CONSTELLATION_DIAGRAM_DECIBEL_LIMIT,
                        this.$$configuration.rx.constellationDiagram.color.axis,
                        this.$$configuration.rx.constellationDiagram.color.historyPoint
                    )
                );
            }
            this.$$rxConstellationDiagram.push({
                constellationDiagram: constellationDiagram,
                queue: queue
            });
        };

        PhysicalLayer.prototype.$$initRx = function () {
            var
                dftWindowSize = MathUtil.round(ActiveAudioContext.getSampleRate() * this.$$configuration.rx.dftWindowTime),
                notifyInterval = MathUtil.round(ActiveAudioContext.getSampleRate() / this.$$configuration.rx.notificationPerSecond),
                channel, i
            ;

            for (i = 0; i < this.$$configuration.rx.channel.length; i++) {
                channel = this.$$configuration.rx.channel[i];

                // attach additional fields to channel object
                channel.dftWindowSize = dftWindowSize;
                channel.notifyInterval = notifyInterval;
                channel.notifyHandler = this.$$rxHandler.handle.bind(this.$$rxHandler);

                if (this.$$configuration.rx.constellationDiagram.elementId) {
                    this.$$initConstellationDiagram(i, channel);
                }
            }
            this.$$channelReceiveManager = ChannelReceiveManagerBuilder.build(
                this.$$configuration.rx.channel,
                this.$$configuration.rx.bufferSize
            );

            this.$$rxAnalyser = ActiveAudioContext.createAnalyser();
            this.$$rxAnalyser.fftSize = this.$$configuration.rx.spectrum.fftSize;
            this.$$rxAnalyser.connect(this.$$channelReceiveManager.getInputNode());
            if (this.$$configuration.rx.spectrum.elementId) {
                if (!document.getElementById(this.$$configuration.rx.spectrum.elementId)) {
                    throw 'Spectrum DOM element not found';
                }
                this.$$rxAnalyserChart = AnalyserChartBuilder.build(
                    document.getElementById(this.$$configuration.rx.spectrum.elementId),
                    this.$$rxAnalyser,
                    this.$$configuration.rx.spectrum.height,
                    this.$$configuration.rx.spectrum.color.data,
                    this.$$configuration.rx.spectrum.color.axis
                );
            }
        };

        PhysicalLayer.prototype.$$getTxInputNode = function (input) {
            var node = null;

            switch (input) {
                case RxInput.MICROPHONE:
                    node = ActiveAudioContext.getMicrophoneNode();
                    break;
                case RxInput.LOOPBACK:
                    node = this.$$channelTransmitManager.getOutputNode();
                    break;
                case RxInput.RECORDED_AUDIO:
                    node = ActiveAudioContext.getRecordedAudioNode();
                    break;
            }

            return node;
        };

        PhysicalLayer.prototype.getRxInput = function () {
            return this.$$currentInput;
        };

        PhysicalLayer.prototype.setRxInput = function (input) {
            var node;

            if (this.$$currentInput) {
                this.$$getTxInputNode(this.$$currentInput).disconnect(this.$$rxAnalyser);
            }

            node = this.$$getTxInputNode(input);
            if (node) {
                node.connect(this.$$rxAnalyser);
                this.$$currentInput = input;
                if (this.$$currentInput === RxInput.LOOPBACK) {
                    this.$$channelTransmitManager.enableFakeNoise();
                } else {
                    this.$$channelTransmitManager.disableFakeNoise();
                }
            } else {
                this.$$currentInput = null;
            }
        };

        PhysicalLayer.prototype.getTxBufferSize = function () {
            return this.$$channelTransmitManager.getBufferSize();
        };

        PhysicalLayer.prototype.getRxBufferSize = function () {
            return this.$$channelReceiveManager.getBufferSize();
        };

        PhysicalLayer.prototype.loadRecordedAudio = function (url) {
            return ActiveAudioContext.loadRecordedAudio(url);
        };

        PhysicalLayer.prototype.tx = function (channelIndex, data) {
            var
                channelTx = this.$$channelTransmitManager.getChannel(channelIndex),
                d, i, dataParsed = []
            ;

            if (!data) {
                throw 'Please specify data to send';
            }

            for (i = 0; i < data.length; i++) {
                d = data[i];
                if (!d.duration) {
                    throw 'Tx - duration of all data items should be > 0';
                }

                dataParsed.push({
                    amplitude: (typeof d.amplitude !== 'undefined') ? d.amplitude : 1,
                    duration: MathUtil.round(ActiveAudioContext.getSampleRate() * d.duration),
                    phase: (typeof d.phase !== 'undefined') ? d.phase : 0
                });
            }

            channelTx.addToQueue(dataParsed);
        };

        PhysicalLayer.prototype.rx = function (rxHandler) {
            this.$$rxExternalHandler.callback = (typeof rxHandler === 'function') ? rxHandler : null;
        };

        PhysicalLayer.prototype.getSampleRate = function () {
            return ActiveAudioContext.getSampleRate();
        };

        PhysicalLayer.prototype.destroy = function () {
            var i, j, promiseList = [];

            this.setRxInput(null);

            // rx
            if (this.$$rxAnalyserChart) {
                promiseList.push(this.$$rxAnalyserChart.destroy());
                this.$$rxAnalyserChart = null;
            }
            this.$$rxAnalyser.disconnect(this.$$channelReceiveManager.getInputNode());
            if (this.$$rxConstellationDiagram) {
                for (i = 0; i < this.$$rxConstellationDiagram.length; i++) {
                    for (j = 0; j < this.$$rxConstellationDiagram[i].constellationDiagram.length; j++) {
                        promiseList.push(
                            this.$$rxConstellationDiagram[i].constellationDiagram[j].destroy()
                        );
                    }
                }
            }
            this.$$channelReceiveManager.destroy();
            this.$$channelReceiveManager = null;

            // tx
            this.outputTxDisable();
            this.outputRecordedAudioDisable();
            this.outputMicrophoneDisable();
            this.$$channelTransmitManager.destroy();
            this.$$channelTransmitManager = null;

            this.$$rxHandler.destroy();

            return SimplePromiseBuilder.buildFromList(promiseList);
        };

        PhysicalLayer.prototype.getOutputTxState = function () {
            return this.$$outputTx;
        };

        PhysicalLayer.prototype.getOutputMicrophoneState = function () {
            return this.$$outputMicrophone;
        };

        PhysicalLayer.prototype.getOutputRecordedAudioState = function () {
            return this.$$outputRecordedAudio;
        };

        PhysicalLayer.prototype.outputTxEnable = function () {
            if (!this.$$outputTx) {
                this.$$channelTransmitManager.getOutputNode().connect(ActiveAudioContext.getDestination());
            }
            this.$$outputTx = true;
        };

        PhysicalLayer.prototype.outputTxDisable = function () {
            if (this.$$outputTx) {
                this.$$channelTransmitManager.getOutputNode().disconnect(ActiveAudioContext.getDestination());
            }
            this.$$outputTx = false;
        };

        PhysicalLayer.prototype.outputMicrophoneEnable = function () {
            if (!this.$$outputMicrophone) {
                ActiveAudioContext.getMicrophoneNode().connect(ActiveAudioContext.getDestination());
            }
            this.$$outputMicrophone = true;
        };

        PhysicalLayer.prototype.outputMicrophoneDisable = function () {
            if (this.$$outputMicrophone) {
                ActiveAudioContext.getMicrophoneNode().disconnect(ActiveAudioContext.getDestination());
            }
            this.$$outputMicrophone = false;
        };

        PhysicalLayer.prototype.outputRecordedAudioEnable = function () {
            if (!this.$$outputRecordedAudio) {
                ActiveAudioContext.getRecordedAudioNode().connect(ActiveAudioContext.getDestination());
            }
            this.$$outputRecordedAudio = true;
        };

        PhysicalLayer.prototype.outputRecordedAudioDisable = function () {
            if (this.$$outputRecordedAudio) {
                ActiveAudioContext.getRecordedAudioNode().disconnect(ActiveAudioContext.getDestination());
            }
            this.$$outputRecordedAudio = false;
        };

        PhysicalLayer.prototype.getRxCpuLoadData = function () {
            return this.$$channelReceiveManager.getCpuLoadData();
        };

        PhysicalLayer.prototype.getTxCpuLoadData = function () {
            return this.$$channelTransmitManager.getCpuLoadData();
        };

        PhysicalLayer.prototype.getRxFrequency = function (channelIndex, ofdmIndex) {
            return (
                this.$$channelReceiveManager
                    .getChannel(channelIndex)
                    .getFrequency(ofdmIndex)
            );
        };

        PhysicalLayer.prototype.getTxFrequency = function (channelIndex, ofdmIndex) {
            return (
                this.$$channelTransmitManager
                .getChannel(channelIndex)
                .getFrequency(ofdmIndex)
            );
        };

        PhysicalLayer.prototype.setRxFrequency = function (channelIndex, ofdmIndex, frequency) {
            this.$$channelReceiveManager
                .getChannel(channelIndex)
                .setFrequency(ofdmIndex, frequency)
            ;
        };

        PhysicalLayer.prototype.setTxFrequency = function (channelIndex, ofdmIndex, frequency) {
            this.$$channelTransmitManager
                .getChannel(channelIndex)
                .setFrequency(ofdmIndex, frequency)
            ;
        };


        PhysicalLayer.prototype.getRxPhaseCorrection = function (channelIndex, ofdmIndex) {
            return (
                this.$$channelReceiveManager
                    .getChannel(channelIndex)
                    .getRxPhaseCorrection(ofdmIndex)
            );
        };

        PhysicalLayer.prototype.getTxPhaseCorrection = function (channelIndex, ofdmIndex) {
            return (
                this.$$channelTransmitManager
                .getChannel(channelIndex)
                .getTxPhaseCorrection(ofdmIndex)
            );
        };

        PhysicalLayer.prototype.setRxPhaseCorrection = function (channelIndex, ofdmIndex, phaseCorrection) {
            this.$$channelReceiveManager
                .getChannel(channelIndex)
                .setRxPhaseCorrection(ofdmIndex, phaseCorrection)
            ;
        };

        PhysicalLayer.prototype.setTxPhaseCorrection = function (channelIndex, ofdmIndex, phaseCorrection) {
            this.$$channelTransmitManager
                .getChannel(channelIndex)
                .setTxPhaseCorrection(ofdmIndex, phaseCorrection)
            ;
        };

        PhysicalLayer.prototype.getTxChannelSize = function () {
            return this.$$channelTransmitManager.getChannelSize();
        };

        PhysicalLayer.prototype.getRxChannelSize = function () {
            return this.$$channelReceiveManager.getChannelSize();
        };

        PhysicalLayer.prototype.getTxChannelOfdmSize = function (channelIndex) {
            return this.$$channelTransmitManager.getChannel(channelIndex).getOfdmSize();
        };

        PhysicalLayer.prototype.getRxChannelOfdmSize = function (channelIndex) {
            return this.$$channelReceiveManager.getChannel(channelIndex).getOfdmSize();
        };

        return PhysicalLayer;
    }

})();
