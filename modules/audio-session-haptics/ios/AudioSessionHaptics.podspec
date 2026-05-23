Pod::Spec.new do |s|
  s.name           = 'AudioSessionHaptics'
  s.version        = '1.0.0'
  s.summary        = 'Audio session haptics controls'
  s.description    = 'Allows iOS haptics and system sounds during audio recording.'
  s.author         = 'Just Speak It'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
