// Copyright (c) 2015-2018 Robert Rypuła - https://audio-network.rypula.pl
'use strict';

var
    AudioMonoIO = AudioNetwork.Rewrite.WebAudio.AudioMonoIO,
    WavAudioFile = AudioNetwork.Rewrite.Util.WavAudioFile;

// TODO extract modulation types to classes
// TODO use WaveGenerator instead of generateSineWave function

var
    CANVAS_HEIGHT = 201,
    RECORD_TIME = 2,    // seconds
    SEPARATION_BITS = 1,
    SEPARATION_BINARY_VALUES = 1,
    SEPARATION_MODULATION_TYPE = 1,
    AMPLITUDE_ONE_UNIT = 1,
    PHASE_NO_OFFSET = 0,
    PHASE_OFFSET_BPSK_180_DEEGRE = 0.5,
    PHASE_OFFSET_OFDM_BPSK_DATA_SUBCARRIER_HIGH = 0.0,
    PHASE_OFFSET_OFDM_BPSK_DATA_SUBCARRIER_LOW = PHASE_OFFSET_OFDM_BPSK_DATA_SUBCARRIER_HIGH + PHASE_OFFSET_BPSK_180_DEEGRE,
    PHASE_OFFSET_BPSK_HIGH = 0.0,
    PHASE_OFFSET_BPSK_LOW = PHASE_OFFSET_BPSK_HIGH + PHASE_OFFSET_BPSK_180_DEEGRE,
    domCanvasContainerRecord,
    domCanvasContainerPlay,
    domAudioMonoIoInitDiv,
    domRecordButton,
    domPlayButton,
    domLoopbackCheckbox,
    domNumberOfBinaryValues,
    domNumberOfBinaryValuesRepetitions,
    domSamplePerSymbol,
    domCycleLow,
    domCycleHigh,
    domAmplitudeLow,
    domAmplitudeHigh,
    domOfdmGuard,
    domOfdmGuardWindow,
    domOfdmSymbolRepetition,
    domOfdmFrequencyBinIndexPilot,
    domOfdmFrequencyBinIndexData,
    domSequenceDuration,
    domRawSamplesPlay,
    domWavPlay,
    domRawSamplesRecord,
    domWavRecord,
    domModulationBaskCheckbox,
    domModulationAskCheckbox,
    domModulationBpskCheckbox,
    domModulationPskCheckbox,
    domModulationBfskCheckbox,
    domModulationFskCheckbox,
    domModulationChirpCheckbox,
    domModulationOfdmCheckbox,
    domSeparateBitsCheckbox,
    domSeparateBinaryValuesCheckbox,
    domSeparateModulationTypesCheckbox,
    bufferSize,
    audioMonoIO,
    recordInProgress = false,
    playInProgress = false,
    recordNeverStarted = true,
    bufferRecorded,
    bufferRecordedLimit,
    timeDomainBlock = [],
    samplePerSymbol,
    samplePerPeriodLow,
    samplePerPeriodHigh,
    cycleLow,
    cycleHigh,
    amplitudeLow,
    amplitudeHigh,
    lastOfdmSymbolPilot,
    lastOfdmSymbolData,
    lastOfdmSymbolAvailable = false,

    MODULATION_TYPE = {
        'BASK': 'BASK',
        'ASK': 'ASK',
        'BPSK': 'BPSK',
        'PSK': 'PSK',
        'BFSK': 'BFSK',
        'FSK': 'FSK',
        'CHIRP': 'CHIRP',
        'OFDM': 'OFDM'
    };

function init() {
    domCanvasContainerRecord = document.getElementById('canvas-container-record');
    domCanvasContainerPlay = document.getElementById('canvas-container-play');
    domAudioMonoIoInitDiv = document.getElementById('audio-mono-io-init-div');
    domRecordButton = document.getElementById('record-button');
    domPlayButton = document.getElementById('play-button');
    domLoopbackCheckbox = document.getElementById('loopback-checkbox');
    domNumberOfBinaryValues = document.getElementById('number-of-binary-values');
    domNumberOfBinaryValuesRepetitions = document.getElementById('number-of-binary-values-repetitions');
    domSamplePerSymbol = document.getElementById('sample-per-symbol');
    domCycleLow = document.getElementById('cycle-low');
    domCycleHigh = document.getElementById('cycle-high');
    domAmplitudeLow = document.getElementById('amplitude-low');
    domAmplitudeHigh = document.getElementById('amplitude-high');
    domOfdmGuard = document.getElementById('ofdm-guard');
    domOfdmGuardWindow = document.getElementById('ofdm-guard-window');
    domOfdmSymbolRepetition = document.getElementById('ofdm-symbol-repetition');
    domOfdmFrequencyBinIndexPilot = document.getElementById('ofdm-frequency-bin-index-pilot');
    domOfdmFrequencyBinIndexData = document.getElementById('ofdm-frequency-bin-index-data');
    domSequenceDuration = document.getElementById('sequence-duration');
    domRawSamplesPlay = document.getElementById('raw-samples-play');
    domWavPlay = document.getElementById('wav-play');
    domRawSamplesRecord = document.getElementById('raw-samples-record');
    domWavRecord = document.getElementById('wav-record');
    domModulationBaskCheckbox = document.getElementById('modulation-bask-checkbox');
    domModulationAskCheckbox = document.getElementById('modulation-ask-checkbox');
    domModulationBpskCheckbox = document.getElementById('modulation-bpsk-checkbox');
    domModulationPskCheckbox = document.getElementById('modulation-psk-checkbox');
    domModulationBfskCheckbox = document.getElementById('modulation-bfsk-checkbox');
    domModulationFskCheckbox = document.getElementById('modulation-fsk-checkbox');
    domModulationChirpCheckbox = document.getElementById('modulation-chirp-checkbox');
    domModulationOfdmCheckbox = document.getElementById('modulation-ofdm-checkbox');

    domSeparateBitsCheckbox = document.getElementById('separate-bits-checkbox');
    domSeparateBinaryValuesCheckbox = document.getElementById('separate-binary-value-checkbox');
    domSeparateModulationTypesCheckbox = document.getElementById('separate-modulation-types-checkbox');
}

function onLoopbackCheckboxChange() {
    if (audioMonoIO) {
        audioMonoIO.setLoopback(domLoopbackCheckbox.checked);
    }
}

function onAudioMonoIoInitClick(bufferSizeValue) {
    var bufferDuration;

    bufferSize = bufferSizeValue;
    audioMonoIO = new AudioMonoIO(AudioMonoIO.FFT_SIZE, bufferSize);
    audioMonoIO.setSampleInHandler(sampleInHandler);

    onLoopbackCheckboxChange();

    bufferDuration = bufferSize / audioMonoIO.getSampleRate();
    bufferRecordedLimit = Math.ceil(RECORD_TIME / bufferDuration);

    domAudioMonoIoInitDiv.parentNode.removeChild(domAudioMonoIoInitDiv);
    domRecordButton.innerHTML = 'Start';
    domPlayButton.innerHTML = 'Generate and Play';
}

function onRecordClick() {
    if (recordInProgress || !audioMonoIO) {
        return;
    }

    domRecordButton.innerHTML = 'Recording...';
    recordNeverStarted = false;
    recordInProgress = true;
    bufferRecorded = 0;
    timeDomainBlock.length = 0;
    domCanvasContainerRecord.innerHTML = '';
    domCanvasContainerRecord.style.width = '0';
    domRawSamplesRecord.value = '';
}

function onPlayClick() {
    var
        testSoundBuffer,
        i,
        canvasHtml,
        ctx,
        timeDomainBlock,
        modulationTypeList,
        url,
        filename;

    if (playInProgress || !audioMonoIO) {
        return;
    }

    // global variables
    samplePerSymbol = parseInt(domSamplePerSymbol.value);  // TODO implement fractional symbol durations
    cycleLow = parseFloat(domCycleLow.value);
    cycleHigh = parseFloat(domCycleHigh.value);
    amplitudeLow = parseFloat(domAmplitudeLow.value);
    amplitudeHigh = parseFloat(domAmplitudeHigh.value);
    samplePerPeriodLow = samplePerSymbol / cycleLow;
    samplePerPeriodHigh = samplePerSymbol / cycleHigh;

    modulationTypeList = getSelectedModulationTypes();
    testSoundBuffer = getTestSoundBuffer(modulationTypeList);
    addBufferToWebAudioApi(testSoundBuffer);
    playInProgress = true;
    domSequenceDuration.innerHTML =
        (testSoundBuffer.length / audioMonoIO.getSampleRate()).toFixed(3) + ' sec';
    domPlayButton.innerHTML = 'Playing in a loop...';
    domRawSamplesPlay.value = dumpAsAsciiSoundFile(testSoundBuffer);

    url = WavAudioFile.getBlobUrl(testSoundBuffer, audioMonoIO.getSampleRate());
    filename = 'play_' + WavAudioFile.getFilename();
    domWavPlay.innerHTML =
        '<a id="link" href="' + url + '" download="' + filename + '">' +
        'Download ' + filename +
        '</a>';

    canvasHtml = '';
    timeDomainBlock = getTimeDomainBlockFromBuffer(testSoundBuffer);
    for (i = 0; i < timeDomainBlock.length; i++) {
        canvasHtml += '<canvas id="canvas-block-play-' + i + '"></canvas>';
    }
    domCanvasContainerPlay.innerHTML = canvasHtml;
    domCanvasContainerPlay.style.width = timeDomainBlock.length * bufferSize + timeDomainBlock.length + 'px';
    for (i = 0; i < timeDomainBlock.length; i++) {
        ctx = getConfiguredCanvasContext(
            'canvas-block-play-' + i,
            bufferSize,
            CANVAS_HEIGHT
        );
        drawTimeDomainData(ctx, timeDomainBlock[i], i, audioMonoIO.getSampleRate());
    }
}

// -----------------------------------------------------------------------
// utils

function getIntArrayFromString(str) {
    var
        result = [],
        split,
        i;

    if (str === '') {
        return result;
    }

    split = str.split(' ');
    for (i = 0; i < split.length; i++) {
        result.push(parseInt(split[i]));
    }

    return result;
}

function addBufferToWebAudioApi(testSoundBuffer) {
    var
        buffer,
        i,
        bufferChannelData,
        bufferSourceNode;

    // TODO create method in AudioMonoIO class for creatingBuffer !!!
    buffer = audioMonoIO
        .$$audioContext
        .createBuffer(
            1,
            testSoundBuffer.length,
            audioMonoIO.getSampleRate()
        );
    bufferChannelData = buffer.getChannelData(0);
    for (i = 0; i < testSoundBuffer.length; i++) {
        bufferChannelData[i] = testSoundBuffer[i];
    }
    bufferSourceNode = audioMonoIO
        .$$audioContext
        .createBufferSource();
    bufferSourceNode.buffer = buffer;

    bufferSourceNode.connect(audioMonoIO.$$masterOut);
    bufferSourceNode.loop = true;
    bufferSourceNode.start();
}

function getSelectedModulationTypes() {
    var modulationTypeList = [];

    if (domModulationBaskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.BASK);
    }
    if (domModulationAskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.ASK);
    }
    if (domModulationBpskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.BPSK);
    }
    if (domModulationPskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.PSK);
    }
    if (domModulationBfskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.BFSK);
    }
    if (domModulationFskCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.FSK);
    }
    if (domModulationChirpCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.CHIRP);
    }
    if (domModulationOfdmCheckbox.checked) {
        modulationTypeList.push(MODULATION_TYPE.OFDM);
    }

    return modulationTypeList;
}

function getTimeDomainBlockFromBuffer(buffer) {
    var i, output, block;

    output = [];
    for (i = 0; i < buffer.length; i++) {
        if (i % bufferSize === 0) {
            block = [];
        }
        block.push(buffer[i]);
        if (i % bufferSize === bufferSize - 1 || i === buffer.length - 1) {
            output.push(block);
        }
    }

    return output;
}

function dumpAsAsciiSoundFile(buffer) {
    var output, i;

    output = '[ASCII ' + audioMonoIO.getSampleRate() + 'Hz, Channels: 1, Samples: ' + buffer.length + ', Flags: 0]\n';
    for (i = 0; i < buffer.length; i++) {
        output += buffer[i].toFixed(6) + '\n';
    }

    return output;
}

function generateSineWave(samplePerPeriod, amplitude, unitPhaseOffset, sample) {
    var x;

    x = 2 * Math.PI * (sample / samplePerPeriod - unitPhaseOffset);

    return amplitude * Math.sin(x);
}

function arraySmartCopy(src, size) {
    var result, index, srcLength, limit, i, isFromBack, element;

    srcLength = src.length;
    isFromBack = size < 0;
    limit = Math.min(
        srcLength,
        Math.abs(size)
    );
    result = [];
    for (i = 0; i < limit; i++) {
        index = isFromBack
            ? srcLength - limit + i
            : i;
        element = src[index];
        result.push(element);
    }

    return result;
}

function arrayAdd(src1, src2) {
    var result, i, element;

    // assumed that two arrays are the same length
    result = [];
    for (i = 0; i < src1.length; i++) {
        element = src1[i] + src2[i];
        result.push(element);
    }

    return result;
}

function arrayDivide(src, scalar) {
    var result, i, element;

    result = [];
    for (i = 0; i < src.length; i++) {
        element = src[i] / scalar;
        result.push(element);
    }

    return result;
}

function arrayAppend(a, b) {
    var i;

    for (i = 0; i < b.length; i++) {
        a.push(b[i]);
    }
}

function applyCosineWindow(data, isZeroToOne) {
    var i, windowValue, N;

    N = data.length;
    for (i = 0; i < N; i++) {
        windowValue = cosineWindow(i, N);
        if (isZeroToOne) {
            windowValue = 1 - windowValue;
        }
        data[i] *= windowValue;
    }
}

function cosineWindow(n, N) {
    var cos;

    cos = Math.cos(Math.PI * n / (N - 1));

    return (cos + 1) / 2;
}

// -----------------------------------------------------------------------
// test sound

function appendBinaryAskSymbol(buffer, isOne) {
    var i, sample, amplitude;

    for (i = 0; i < samplePerSymbol; i++) {
        amplitude = isOne
            ? amplitudeHigh
            : amplitudeLow;
        sample = generateSineWave(
            samplePerPeriodLow,
            amplitude,
            PHASE_NO_OFFSET,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendAskSymbol(buffer, binaryValueFactor) {
    var i, sample, diff, amplitude;

    for (i = 0; i < samplePerSymbol; i++) {
        diff = amplitudeHigh - amplitudeLow;
        amplitude = amplitudeLow + diff * binaryValueFactor;
        sample = generateSineWave(
            samplePerPeriodLow,
            amplitude,
            PHASE_NO_OFFSET,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendBinaryPskSymbol(buffer, isOne) {
    var i, sample, phase;

    for (i = 0; i < samplePerSymbol; i++) {
        phase = isOne
            ? PHASE_OFFSET_BPSK_HIGH
            : PHASE_OFFSET_BPSK_LOW;
        sample = generateSineWave(
            samplePerPeriodLow,
            AMPLITUDE_ONE_UNIT,
            phase,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendPskSymbol(buffer, value, numberOfBinaryValues) {
    var i, sample, phase;

    for (i = 0; i < samplePerSymbol; i++) {
        phase = value / numberOfBinaryValues;
        sample = generateSineWave(
            samplePerPeriodLow,
            AMPLITUDE_ONE_UNIT,
            phase,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendBinaryFskSymbol(buffer, isOne) {
    var i, sample, samplePerPeriod;

    for (i = 0; i < samplePerSymbol; i++) {
        samplePerPeriod = isOne
            ? samplePerPeriodHigh
            : samplePerPeriodLow;
        sample = generateSineWave(
            samplePerPeriod,
            AMPLITUDE_ONE_UNIT,
            PHASE_NO_OFFSET,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendFskSymbol(buffer, binaryValueFactor) {
    var i, sample, samplePerPeriod, cycle, diff;

    for (i = 0; i < samplePerSymbol; i++) {
        diff = cycleHigh - cycleLow;
        cycle = cycleLow + diff * binaryValueFactor;
        samplePerPeriod = samplePerSymbol / cycle;
        sample = generateSineWave(
            samplePerPeriod,
            AMPLITUDE_ONE_UNIT,
            PHASE_NO_OFFSET,
            buffer.length
        );
        buffer.push(sample);
    }
}

function appendChirpSymbol(buffer, isOne) {
    var i, sample, phaseAcceleration, phase, t, samplePerPeriod;

    phase = 0;
    // LOW symbol will be chirp that goes from low frequency to high
    // HIGH symbol will be chirp that goes from high frequency to low
    phaseAcceleration = (cycleHigh - cycleLow) * (isOne ? -1 : 1);
    for (i = 0; i < samplePerSymbol; i++) {
        t = i / samplePerSymbol;
        phase = phaseAcceleration * t * t / 2;
        samplePerPeriod = isOne
            ? samplePerPeriodLow
            : samplePerPeriodHigh;
        // FM modulation can be expressed as phase modulation
        sample = generateSineWave(
            samplePerPeriod,
            AMPLITUDE_ONE_UNIT,
            phase,
            buffer.length
        );

        buffer.push(sample);
    }
}

function getOfdmGuard(ofdmSymbolPilot, ofdmSymbolData) {
    var
        guardLength,
        guard,
        symbolEndPilot,
        symbolEndData,
        lastSymbolStartPilot,
        lastSymbolStartData,
        a,
        b;

    guardLength = Math.round(ofdmSymbolPilot.length * parseFloat(domOfdmGuard.value));
    symbolEndPilot = arraySmartCopy(ofdmSymbolPilot, -guardLength);
    symbolEndData = arraySmartCopy(ofdmSymbolData, -guardLength);

    if (domOfdmGuardWindow.checked) {
        lastSymbolStartPilot = arraySmartCopy(lastOfdmSymbolPilot, guardLength);
        lastSymbolStartData = arraySmartCopy(lastOfdmSymbolData, guardLength);

        a = arrayAdd(lastSymbolStartPilot, lastSymbolStartData);
        applyCosineWindow(a, false);
        //a = arrayDivide(a, 1000000);    // TODO remove me

        b = arrayAdd(symbolEndPilot, symbolEndData);
        applyCosineWindow(b, true);
        //b = arrayDivide(b, 1000000);    // TODO remove me

        guard = arrayAdd(a, b);
    } else {
        guard = arrayAdd(symbolEndPilot, symbolEndData);
    }

    return guard;
}

function appendOfdmSymbol(output, binaryValue) {
    var ofdmSymbolPilot, ofdmSymbolData, i, ofdmGuard, normalizeFactor, ofdmSymbol, frequencyBinIndexPilot, frequencyBinIndexData;

    frequencyBinIndexPilot = getOfdmFrequencyBinIndexPilot();
    frequencyBinIndexData = getOfdmFrequencyBinIndexData();
    normalizeFactor = frequencyBinIndexPilot.length + frequencyBinIndexData.length;

    ofdmSymbolPilot = getOfdmSymbolPilot();
    ofdmSymbolData = getOfdmSymbolData(binaryValue);

    if (parseFloat(domOfdmGuard.value) > 0) {
        if (lastOfdmSymbolAvailable) {
            ofdmGuard = getOfdmGuard(ofdmSymbolPilot, ofdmSymbolData);
            ofdmGuard = arrayDivide(ofdmGuard, normalizeFactor);
            arrayAppend(output, ofdmGuard);
        }
        lastOfdmSymbolPilot = arraySmartCopy(ofdmSymbolPilot, ofdmSymbolPilot.length);
        lastOfdmSymbolData = arraySmartCopy(ofdmSymbolData, ofdmSymbolData.length);
        lastOfdmSymbolAvailable = true;
    }

    for (i = 0; i < parseInt(domOfdmSymbolRepetition.value); i++) {
        ofdmSymbol = arrayAdd(ofdmSymbolPilot, ofdmSymbolData);
        ofdmSymbol = arrayDivide(ofdmSymbol, normalizeFactor);
        arrayAppend(output, ofdmSymbol);
    }
}

function getOfdmSymbolData(binaryValue) {
    var i, bit, isOne, cycles, samplePerPeriod,  ofdmSymbol, phase, sample, frequencyBinIndexData;

    frequencyBinIndexData = getOfdmFrequencyBinIndexData();

    ofdmSymbol = [];
    for (i = 0; i < samplePerSymbol; i++) {
        ofdmSymbol.push(0);
    }

    // add data subcarriers
    for (bit = 0; bit < binaryValue.length; bit++) {
        if (bit >= frequencyBinIndexData.length) {
            break;
        }

        isOne = (binaryValue[bit] === '1');
        for (i = 0; i < samplePerSymbol; i++) {
            cycles = frequencyBinIndexData[bit];
            samplePerPeriod = samplePerSymbol / cycles;
            phase = isOne
                ? PHASE_OFFSET_OFDM_BPSK_DATA_SUBCARRIER_HIGH
                : PHASE_OFFSET_OFDM_BPSK_DATA_SUBCARRIER_LOW;
            sample = generateSineWave(
                samplePerPeriod,
                AMPLITUDE_ONE_UNIT,
                phase,
                i
            );

            ofdmSymbol[i] += sample;
        }
    }

    return ofdmSymbol;
}

function getOfdmSymbolPilot() {
    var i, pilot, cycles, samplePerPeriod,  ofdmSymbol, sample, frequencyBinIndexPilot;

    ofdmSymbol = [];
    for (i = 0; i < samplePerSymbol; i++) {
        ofdmSymbol.push(0);
    }

    frequencyBinIndexPilot = getOfdmFrequencyBinIndexPilot();
    for (pilot = 0; pilot < frequencyBinIndexPilot.length; pilot++) {
        for (i = 0; i < samplePerSymbol; i++) {
            cycles = frequencyBinIndexPilot[pilot];
            samplePerPeriod = samplePerSymbol / cycles;
            sample = generateSineWave(
                samplePerPeriod,
                AMPLITUDE_ONE_UNIT,
                PHASE_NO_OFFSET,
                i
            );
            ofdmSymbol[i] += sample;
        }
    }

    return ofdmSymbol;
}

function getOfdmFrequencyBinIndexPilot() {
    return getIntArrayFromString(
        domOfdmFrequencyBinIndexPilot.value + ''
    );
}

function getOfdmFrequencyBinIndexData() {
    return getIntArrayFromString(
        domOfdmFrequencyBinIndexData.value + ''
    );
}

function appendWhiteNoise(buffer, amount) {
    var i;

    for (i = 0; i < amount * samplePerSymbol; i++) {
        buffer.push(
            -1 + Math.random() * 2
        );
    }
}

function appendSilence(buffer, amount) {
    var i;

    for (i = 0; i < amount * samplePerSymbol; i++) {
        buffer.push(0);
    }
}

function appendSymbol(output, modulationType, binaryValue) {
    var i, isOne;

    for (i = 0; i < binaryValue.length; i++) {
        isOne = (binaryValue[i] === '1');

        switch (modulationType) {
            case MODULATION_TYPE.BASK:
                appendBinaryAskSymbol(output, isOne);
                break;
            case MODULATION_TYPE.BPSK:
                appendBinaryPskSymbol(output, isOne);
                break;
            case MODULATION_TYPE.BFSK:
                appendBinaryFskSymbol(output, isOne);
                break;
            case MODULATION_TYPE.CHIRP:
                appendChirpSymbol(output, isOne);
                break;
        }

        if (domSeparateBitsCheckbox.checked) {
            appendSilence(output, SEPARATION_BITS);
        }
    }
}

function getTestSoundBuffer(modulationTypeList) {
    var
        i,
        value,
        repetition,
        binaryValue,
        binaryValueFactor,
        numberOfBinaryValues,
        numberOfBinaryValuesRepetitions,
        output,
        modulationType;

    output = [];
    numberOfBinaryValues = parseInt(domNumberOfBinaryValues.value);
    numberOfBinaryValuesRepetitions = parseInt(domNumberOfBinaryValuesRepetitions.value);
    for (i = 0; i < modulationTypeList.length; i++) {
        modulationType = modulationTypeList[i];

        for (repetition = 0; repetition < numberOfBinaryValuesRepetitions; repetition++) {
            for (value = 0; value < numberOfBinaryValues; value++) {
                binaryValue = value.toString(2);
                binaryValue = pad(binaryValue, (numberOfBinaryValues - 1).toString(2).length);
                binaryValueFactor = value / (numberOfBinaryValues - 1);
                switch (modulationType) {
                    case MODULATION_TYPE.ASK:
                        appendAskSymbol(output, binaryValueFactor);
                        break;
                    case MODULATION_TYPE.PSK:
                        appendPskSymbol(output, value, numberOfBinaryValues);
                        break;
                    case MODULATION_TYPE.FSK:
                        appendFskSymbol(output, binaryValueFactor);
                        break;
                    case MODULATION_TYPE.OFDM:
                        appendOfdmSymbol(output, binaryValue);
                        break;
                    default:
                        appendSymbol(output, modulationType, binaryValue);
                }
                if (domSeparateBinaryValuesCheckbox.checked) {
                    appendSilence(output, SEPARATION_BINARY_VALUES);
                }
            }
        }

        if (domSeparateModulationTypesCheckbox.checked) {
            appendSilence(output, SEPARATION_MODULATION_TYPE);
        }
    }

    return output;
}

// -----------------------------------------------------------------------
// animation, canvas 2d context

function clear(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.stroke();
}

function getConfiguredCanvasContext(elementId, width, height) {
    var element, ctx;

    element = document.getElementById(elementId);
    element.width = width;
    element.height = height;
    ctx = element.getContext('2d');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2d4e8a';
    ctx.font = "12px Arial";

    return ctx;
}

function drawTimeDomainData(ctx, data, offset, sampleRate) {
    var limit, hMid, x, y1, y2, duration;

    clear(ctx);

    hMid = Math.floor(0.5 * CANVAS_HEIGHT);
    limit = data.length;
    for (x = 0; x < limit - 1; x++) {
        y1 = hMid * (1 - data[x]);
        y2 = hMid * (1 - data[x + 1]);
        drawLine(ctx, x, y1, x + 1, y2);
    }

    duration = bufferSize / sampleRate;
    for (x = 0; x < data.length; x += 128) {
        drawLine(ctx, x, 0, x, 12);
        ctx.fillText(
            ((duration * offset + x / sampleRate) * 1000).toFixed(1) + ' ms',
            x + 4,
            10
        );
        drawLine(ctx, x, CANVAS_HEIGHT, x, CANVAS_HEIGHT - 12);
        ctx.fillText(
            (bufferSize * offset + x).toFixed(0),
            x + 4,
            CANVAS_HEIGHT - 2
        );
    }

    drawLine(ctx, 0, 0, 0, 2 * hMid);
    ctx.fillText(
        'Buffer #' + offset,
        4,
        25
    );
}

// -----------------------------------------------------------------------
// data handlers

function sampleInHandler(monoIn) {
    if (recordNeverStarted) {
        return;
    }

    if (bufferRecorded >= bufferRecordedLimit) {
        recordInProgress = false;
        domRecordButton.innerHTML = 'Start again';
        return;
    }

    // This line is very important due to:
    // - http://stackoverflow.com/questions/24069400/web-audio-api-recording-works-in-firefox-but-not-chrome
    // - http://stackoverflow.com/questions/3978492/javascript-fastest-way-to-duplicate-an-array-slice-vs-for-loop/21514254#21514254
    timeDomainBlock.push(monoIn.slice(0));
    bufferRecorded++;

    if (bufferRecorded === bufferRecordedLimit) {
        showRecording();
    }
}

function showRecording() {
    var i, j, ctx, canvasHtml, buffer, url, filename;

    canvasHtml = '';
    for (i = 0; i < timeDomainBlock.length; i++) {
        canvasHtml += '<canvas id="canvas-block-record-' + i + '"></canvas>';
    }
    domCanvasContainerRecord.innerHTML = canvasHtml;
    domCanvasContainerRecord.style.width = timeDomainBlock.length * bufferSize + timeDomainBlock.length + 'px';
    for (i = 0; i < timeDomainBlock.length; i++) {
        ctx = getConfiguredCanvasContext(
            'canvas-block-record-' + i,
            bufferSize,
            CANVAS_HEIGHT
        );
        drawTimeDomainData(ctx, timeDomainBlock[i], i, audioMonoIO.getSampleRate());
    }

    buffer = [];
    for (i = 0; i < timeDomainBlock.length; i++) {
        for (j = 0; j < timeDomainBlock[i].length; j++) {
            buffer.push(timeDomainBlock[i][j]);
        }
    }
    domRawSamplesRecord.value = dumpAsAsciiSoundFile(buffer);

    url = WavAudioFile.getBlobUrl(buffer, audioMonoIO.getSampleRate());
    filename = 'record_' + WavAudioFile.getFilename();
    domWavRecord.innerHTML =
        '<a id="link" href="' + url + '" download="' + filename + '">' +
        'Download ' + filename +
        '</a>';
}
