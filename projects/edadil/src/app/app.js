try {
    var decodedMessage = AwesomeMessage.decode(buffer);
} catch (e) {
    if (e instanceof protobuf.util.ProtocolError) {
        // e.instance holds the so far decoded message with missing required fields
    } else {
        // wire format is invalid
    }
}
