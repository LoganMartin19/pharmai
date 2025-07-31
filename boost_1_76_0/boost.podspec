Pod::Spec.new do |spec|
  spec.name         = 'boost'
  spec.version      = '1.76.0'
  spec.summary      = 'Boost provides free peer-reviewed portable C++ source libraries.'
  spec.description  = 'Boost provides free peer-reviewed portable C++ source libraries.'
  spec.homepage     = 'https://www.boost.org'
  spec.license      = { :type => 'Boost Software License', :file => 'LICENSE_1_0.txt' }
  spec.author       = 'Boost'
  spec.source       = { :path => '.' }

  spec.header_mappings_dir = 'boost'
  spec.source_files = 'boost/**/*.{hpp,h}'
  spec.exclude_files = '**/doc/**'
  spec.requires_arc = false
  spec.platform     = :ios, '13.0'
end