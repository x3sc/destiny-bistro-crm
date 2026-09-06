Pod::Spec.new do |s|
  s.name           = 'ThermalPrinter'
  s.version        = '1.0.0'
  s.summary        = 'Destiny Bistro RAW TCP thermal printer module'
  s.description    = 'Sends ESC/POS bytes to a configured LAN printer.'
  s.author         = 'Destiny Bistro'
  s.homepage       = 'https://github.com/x3sc/destiny-bistro-crm'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.frameworks = 'Network'
end
