// Copyright (c) 2015-2018 Robert Rypuła - https://audio-network.rypula.pl
(function () {
    'use strict';

    AudioNetwork.Injector
        .registerFactory('PhysicalLayerAdapter.PhaseOffsetCollector', _PhaseOffsetCollector);

    _PhaseOffsetCollector.$inject = [
        'Common.AbstractValueCollector',
        'Common.MathUtil'
    ];

    function _PhaseOffsetCollector(
        AbstractValueCollector,
        MathUtil
    ) {
        var PhaseOffsetCollector;

        PhaseOffsetCollector = function () {
            AbstractValueCollector.apply(this, arguments);
        };

        PhaseOffsetCollector.prototype = Object.create(AbstractValueCollector.prototype);
        PhaseOffsetCollector.prototype.constructor = PhaseOffsetCollector;

        PhaseOffsetCollector.prototype.$$finalize = function () {
            var
                i, indexA, indexB, drift,
                str = '';

            if (this.$$valueList.length === 0) {
                return null;
            }

            // TODO rewrite this temporary code
            for (i = 0; i < this.$$valueList.length; i++) {
                str += (
                    (MathUtil.round(this.$$valueList[i].time * 1000) / 1000) + ' ' +
                    (MathUtil.round(this.$$valueList[i].phase * 1000) / 1000) + ' | '
                );
            }

            indexA = MathUtil.round(0.43 * this.$$valueList.length);
            indexB = MathUtil.round(0.57 * this.$$valueList.length);
            indexB = indexB >= this.$$valueList.length ? this.$$valueList.length - 1 : indexB;
            drift = 0;
            if (indexA !== indexB && indexA < indexB) {
                console.log('phase history indexA', this.$$valueList[indexA].time, this.$$valueList[indexA].phase);
                console.log('phase history indexB', this.$$valueList[indexB].time, this.$$valueList[indexB].phase);
                drift = -(this.$$valueList[indexB].phase - this.$$valueList[indexA].phase) / (this.$$valueList[indexB].time - this.$$valueList[indexA].time);
                console.log('phase history drift', drift);
            }

            return drift;
        };

        PhaseOffsetCollector.prototype.collect = function (value) {
            // TODO rewrite this temporary code
            this.$$valueList.push({
                time: value.stateDurationTime,
                phase: value.carrierDetail[0].phase      // TODO pass all ofdm phases here !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            });                                          // TODO check also powerThreshold to avoid fine-tune on null OFDMs
        };

        return PhaseOffsetCollector;
    }

})();
