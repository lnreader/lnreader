Pod::Spec.new do |s|
  s.name           = 'NativeVolumeButtonListener'
  s.version        = '1.0.0'
  s.summary        = 'NativeVolumeButtonListener module'
  s.description    = 'NativeVolumeButtonListener module'
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://github.com/LNReader/lnreader'
  s.platforms      = { :ios => '15.5', :tvos => '15.5' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
