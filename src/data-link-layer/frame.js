// Copyright (c) 2015-2017 Robert Rypuła - https://audio-network.rypula.pl
'use strict';

(function () {
    AudioNetwork.Injector
        .registerFactory('Rewrite.DataLinkLayer.Frame', Frame);

    Frame.$inject = [
        'Rewrite.DataLinkLayer.ChecksumService'
    ];

    function Frame(
        ChecksumService
    ) {
        var Frame;

        Frame = function (id, payload, isCommand) {
            this.$$id = id;
            this.$$header = undefined;
            this.$$payload = [];
            this.$$checksum = undefined;

            this.setPayload(payload, isCommand);
        };

        Frame.$$_HEADER_FRAME_START_MARKER = 0xE0;
        Frame.$$_HEADER_COMMAND_BIT_SET = 0x10;
        Frame.$$_HEADER_COMMAND_BIT_NOT_SET = 0x00;
        Frame.$$_HEADER_PAYLOAD_LENGTH_MASK = 0x0F;
        Frame.$$_ONE_BYTE_MASK = 0xFF;

        Frame.prototype.getId = function () {
            return this.$$id;
        };

        Frame.prototype.getHeader = function () {
            return this.$$header;
        };

        Frame.prototype.getPayload = function () {
            return this.$$payload;
        };

        Frame.prototype.getChecksum = function () {
            return this.$$checksum;
        };

        Frame.prototype.setPayload = function (payload, isCommand) {
            var frameWithoutChecksum, i, byte;

            frameWithoutChecksum = [];
            this.$$header = Frame.$$generateHeader(isCommand, payload.length);
            frameWithoutChecksum.push(this.$$header);
            this.$$payload.length = 0;
            for (i = 0; i < payload.length; i++) {
                byte = payload[i] & Frame.$$_ONE_BYTE_MASK;
                this.$$payload.push(byte);
                frameWithoutChecksum.push(byte);
            }
            this.$$checksum = Frame.$$computeChecksum(frameWithoutChecksum);
        };

        Frame.$$computeChecksum = function (frameWithoutChecksum) {
            return ChecksumService.fletcher8(frameWithoutChecksum);
        };

        Frame.$$generateHeader = function (isCommand, payloadLength) {
            var frameStartMarker, commandBit, header;

            frameStartMarker = Frame.$$_HEADER_FRAME_START_MARKER;
            commandBit = isCommand
                ? Frame.$$_HEADER_COMMAND_BIT_SET
                : Frame.$$_HEADER_COMMAND_BIT_NOT_SET;
            payloadLength = Frame.$$_HEADER_PAYLOAD_LENGTH_MASK & payloadLength;

            header = frameStartMarker | commandBit | payloadLength;

            return header;
        };

        return Frame;
    }

})();
