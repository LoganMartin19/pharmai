//  AppDelegate.h
//  PharmAI
//
//  Created by Logan Martin on 29/07/2025.
//

#if __has_include(<React-RCTAppDelegate/RCTAppDelegate.h>)
#import <React-RCTAppDelegate/RCTAppDelegate.h>
#elif __has_include(<React_RCTAppDelegate/RCTAppDelegate.h>)
#import <React_RCTAppDelegate/RCTAppDelegate.h>
#else
#import <React/RCTAppDelegate.h>
#endif

@interface AppDelegate : RCTAppDelegate
@end
