package expo.modules.thermalprinter

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetSocketAddress
import java.net.Socket

class ThermalPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThermalPrinter")

    AsyncFunction("print") { host: String, port: Int, payloadBase64: String, timeoutMs: Int ->
      require(host.isNotBlank()) { "Printer host is required" }
      require(port in 1..65535) { "Printer port is invalid" }
      require(timeoutMs in 1000..30000) { "Printer timeout is invalid" }

      val payload = Base64.decode(payloadBase64, Base64.DEFAULT)
      Socket().use { socket ->
        socket.connect(InetSocketAddress(host, port), timeoutMs)
        socket.soTimeout = timeoutMs
        socket.getOutputStream().use { output ->
          output.write(payload)
          output.flush()
        }
      }
      payload.size
    }
  }
}
