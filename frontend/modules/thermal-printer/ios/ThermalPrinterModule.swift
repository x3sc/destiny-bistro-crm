import ExpoModulesCore
import Foundation
import Network

public final class ThermalPrinterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThermalPrinter")

    AsyncFunction("print") { (host: String, port: Int, payloadBase64: String, timeoutMs: Int) async throws -> Int in
      guard !host.isEmpty,
            (1...65_535).contains(port),
            let networkPort = NWEndpoint.Port(rawValue: UInt16(port)),
            (1_000...30_000).contains(timeoutMs),
            let payload = Data(base64Encoded: payloadBase64) else {
        throw ThermalPrinterError.invalidArguments
      }

      try await send(
        payload: payload,
        host: NWEndpoint.Host(host),
        port: networkPort,
        timeoutMs: timeoutMs
      )
      return payload.count
    }
  }
}

private func send(
  payload: Data,
  host: NWEndpoint.Host,
  port: NWEndpoint.Port,
  timeoutMs: Int
) async throws {
  try await withCheckedThrowingContinuation { continuation in
    let connection = NWConnection(host: host, port: port, using: .tcp)
    let queue = DispatchQueue(label: "destiny.thermal-printer")
    let lock = NSLock()
    var completed = false

    func finish(_ result: Result<Void, Error>) {
      lock.lock()
      defer { lock.unlock() }
      guard !completed else { return }
      completed = true
      connection.cancel()
      continuation.resume(with: result)
    }

    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        connection.send(content: payload, completion: .contentProcessed { error in
          if let error {
            finish(.failure(error))
          } else {
            finish(.success(()))
          }
        })
      case .failed(let error):
        finish(.failure(error))
      case .cancelled:
        finish(.failure(ThermalPrinterError.cancelled))
      default:
        break
      }
    }

    queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
      finish(.failure(ThermalPrinterError.timeout))
    }
    connection.start(queue: queue)
  }
}

private enum ThermalPrinterError: Error {
  case cancelled
  case invalidArguments
  case timeout
}
