import argparse

import cv2
import numpy as np
import json
import os

parser = argparse.ArgumentParser(description='Compute Homography')
parser.add_argument("--mode", type=str, default="compute", required=True)
parser.add_argument("--image_points_path", type=str, default=None)
parser.add_argument("--map_points_path", type=str, default=None)
parser.add_argument("--camera_name", type=str, default="camera")
parser.add_argument("--homography_path", type=str, default=None)
parser.add_argument("--frame_path", type=str, default=None)
parser.add_argument("--map_path", type=str, default=None)
parser.add_argument("--output_dir", type=str, default="")
args = parser.parse_args()

# Global variables
colors = [(0, 0, 255), (255, 0, 0), (0, 0, 0), (0, 100, 255), (255, 100, 0), (0, 100, 0), \
(0, 100, 100), (100, 100, 100), (255, 100, 100), (100, 100, 255), (0, 200, 255), (255, 200, 0), \
(200, 200, 0), (0, 200, 200), (200, 100, 200), (255, 200, 200), (200, 200, 255)]

def identify_missing_arguments(mode = "compute_homography"):
    missing_args = []
    if mode == "compute_homography":
        if not (args.image_points_path):
            missing_args.append("--image_points_path")
        if not (args.map_points_path):
            missing_args.append("--map_points_path")
    else: # apply_homography
        if not (args.image_points_path):
            missing_args.append("--image_points_path")
        if not (args.homography_path):
            missing_args.append("--homography_path")
        if not (args.frame_path):
            missing_args.append("--frame_path")
        if not (args.map_path):
            missing_args.append("--map_path")
    return missing_args

def read_points_json(json_path):
    inp_file = open(json_path)
    json_obj = json.load(inp_file)
    points = []
    for val in json_obj["points"]:
        points.append([int(val["x"]), int(val["y"])])
    return np.asarray(points, dtype=np.float32)

def compute_homography():
    inp_points = read_points_json(args.image_points_path)
    map_points = read_points_json(args.map_points_path)
    H, _ = cv2.findHomography(inp_points, map_points)
    h_path = os.path.join(args.output_dir, args.camera_name + "_homography.npy")
    np.save(h_path, H)
    return

def draw_points(points, image_path, op_image_path):
    image = cv2.imread(image_path)
    c = 0
    for point in points:
        # Mark a solid point in the map image. 
        cv2.circle(image, (int(point[0]), int(point[1])), 10, colors[c % len(colors)], -1)
        image = cv2.putText(image, str(c), (int(point[0] - 20), int(point[1] + 45)), cv2.FONT_HERSHEY_SIMPLEX, 
                    1, (0, 0, 0), 2, cv2.LINE_AA)
        c = c + 1
    cv2.imwrite(op_image_path, image)

def apply_homography():
    image_points = read_points_json(args.image_points_path)
    frame_basename = os.path.basename(args.frame_path).split(".")[0]
    map_basename = os.path.basename(args.map_path).split(".")[0]
    H = np.load(args.homography_path)
    # reshape image points to 3 dimensions i.e. (n,2) matrix into (n,1,2)
    warped_points = cv2.perspectiveTransform(image_points.reshape(-1,1,2), H)
    # reshape the warped points back to n,2 shape
    warped_points = warped_points.squeeze().astype(int)

    # Save Annotated Frame
    draw_points(image_points, args.frame_path, os.path.join(args.output_dir, "annotated_" + frame_basename + ".png"))
    # cv2.imshow("annotated frame", cv2.resize(cv2.imread(os.path.join(args.output_dir, "annotated_" + frame_basename + ".png")), (1000, 1000)))
    # Save Annotated Map
    draw_points(warped_points, args.map_path, os.path.join(args.output_dir, "annotated_" + map_basename + ".png"))
    # cv2.imshow("annotated map", cv2.resize(cv2.imread(os.path.join(args.output_dir, "annotated_" + map_basename + ".png")), (1000, 1000)))
    # cv2.waitKey(0)
    return

# Identify Missing Arguments
missing_args = identify_missing_arguments(args.mode)
if missing_args:
    raise AssertionError("Missing input arguments: " + ",".join(missing_args))

if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

if args.mode == "compute_homography":
    compute_homography()
else: # apply_homography
    apply_homography()
