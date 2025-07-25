Pod::Spec.new do |spec|
  spec.name         = 'boost'
  spec.version      = '1.76.0'
  spec.summary      = 'Boost C++ Libraries'
  spec.description  = <<-DESC
    Boost provides free peer-reviewed portable C++ source libraries.
  DESC
  spec.homepage     = 'https://www.boost.org'
  spec.license      = { :type => 'Boost Software License', :file => 'LICENSE_1_0.txt' }
  spec.authors      = { 'Boost' => 'boost@boost.org' }

  spec.source       = { :path => '.' }

  spec.header_dir   = 'boost'
  spec.preserve_paths = ['boost/**/*', 'LICENSE_1_0.txt']
  spec.requires_arc = false
  spec.platforms    = { :ios => '11.0' }
end
