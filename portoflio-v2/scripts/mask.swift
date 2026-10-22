import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard let ciImage = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else { fatalError("could not load image") }
let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else { fatalError("no foreground found") }
let buffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: buffer)
try CIContext().writePNGRepresentation(of: mask, to: URL(fileURLWithPath: args[2]), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray(), options: [:])
print("mask", mask.extent, "instances", result.allInstances.count)
