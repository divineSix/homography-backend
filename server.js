const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http');
const path = require('path');
const port = process.env.PORT || 3001;
const shell = require('shelljs');
const cors = require('cors');

// Multer for reading files via API
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "./resources/uploads")
  },
  filename: (req, file, callback) => {
    // Name of the file to be saved in uploads
    callback(null, "ground_frame.png")
  }
});
var upload = multer({ storage: storage })

// To handle JSON data & form data in APIs. 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow CORS for localhost URLS
app.use(cors({
  // origin: 'http://localhost:4200'
  origin: "*"
}));

// Allow for a directory's static files to be accessible via URL. 
app.use("/public", express.static(path.resolve(__dirname, "resources/visualize-homography")));

// No operation function. Used for callbacks. 
const no_op = () => { };

// POST API: Compute Homography
app.post('/api/compute_homography', (request, res) => {
  var error_obj = {}, response_obj = {};
  // Create sub-directory
  fs.mkdir("./resources/compute-homography", { recursive: true }, no_op);
  // Write the image & map points onto respective json files. 
  fs.writeFileSync("./resources/compute-homography/image_points.json", JSON.stringify({ "points": request.body["image-points"] })); // WriteFile vs WriteFileSync
  fs.writeFileSync("./resources/compute-homography/map_points.json", JSON.stringify({ "points": request.body["map-points"] }))

  var options = {
    "mode": "compute_homography",
    "image_points_path": "./resources/compute-homography/image_points.json",
    "map_points_path": "./resources/compute-homography/map_points.json",
    "output_dir": "./resources/compute-homography"
  };
  let strOptions = constructShellCommand(options);
  let execCmd = "python3 ./resources/homography.py " + strOptions;
  shell.exec(execCmd, { async: false });
  // console.log(execCmd);

  response_obj = {
    "message": "Execution completed!!"
  }
  res.send(response_obj);
});

// POST API: Visualize Homography
app.post("/api/visualize_homography", upload.single("file"), (request, response, next) => {
  var error_obj = null;

  // Error Handling of File in request
  if (!request.file) {
    error_obj = {
      "message": "Please upload the ground frame!",
      "code": 400
    };
    response.status(300).send({ error: error_obj });
    return;
  }

  if (!request.file.mimetype.includes("image")) {
    error_obj = {
      "message": "Please upload an image! Other file types are not supported.",
      "code": 400
    };
    response.status(400).send({ error: error_obj });
    return;
  }

  // Error handling for image-points data in request body
  if (!isValidJSONString(request.body.data)) {
    error_obj = {
      "message": "Please send image points data as a valid JSON!",
      "code": 400
    };
    response.status(400).send({ error: error_obj });
    return;
  }

  // Check if homography matrix exists
  if (!fs.existsSync("./resources/compute-homography/homography_matrix.npy")) {
    error_obj = {
      "message": "Homography matrix not found! Please compute the homography first before visualizing it!",
      "code": 404
    };
    response.status(404).send({ error: error_obj });
    return;
  }

  // TODO: Check for boundary image OR base-map image. 
  if (!fs.existsSync("./resources/visualize-homography/cricket_map.png")) {
    error_obj = {
      "message": "Please add the image of the standard cricket map for visualizing homography!",
      "code": 404
    }
    response.status(404).send({ error: error_obj });
    return;
  }

  // Save the incoming image points in the visualize-homography directory
  dataObj = JSON.parse(request.body.data);
  image_points = dataObj["image-points"];
  image_points_filename = (dataObj["is-boundary"] === true) ? "boundary_points.json" : "image_points.json";
  image_points_filepath = "./resources/visualize-homography/" + image_points_filename;
  // fs.mkdir("./resources/visualize-homography", {recursive: true}, no_op);
  fs.writeFileSync(image_points_filepath, JSON.stringify({ "points": image_points }));

  // Conditional construction of the exec command as a string. 
  base_map_path = "./resources/visualize-homography/cricket_map.png";
  if (!dataObj["is-boundary"]) {
    if (fs.existsSync("./resources/visualize-homography/boundary_map.png"))
      base_map_path = "./resources/visualize-homography/boundary_map.png";
  }

  var options = {
    "mode": "apply_homography",
    "image_points_path": image_points_filepath,
    "homography_path": "./resources/compute-homography/homography_matrix.npy",
    "frame_path": "./resources/uploads/ground_frame.png",
    "map_path": base_map_path,
    "output_dir": "./resources/visualize-homography",
    "is_boundary": (dataObj["is-boundary"] === true)
  }
  let strOptions = constructShellCommand(options);
  let execCmd = "python3 ./resources/homography.py " + strOptions;
  // Trigger the visualization script.
  // console.log(execCmd);
  shell.exec(execCmd, { async: false });

  response_obj = {
    "message": "Execution completed!!",
    "resources": {
      "stitched_image_url": "/public/annotated_stitched_image.png"
    }
  }
  response.send(response_obj);
});

app.post("/api/start_process", (request, response) => {
  shell.exec("bash ./resources/start_shell.sh", { async: true });
  response.send({ message: "Start Script Triggered!"});
});

app.post("/api/stop_process", (request, response) => {
  shell.exec("bash ./resources/stop_shell.sh", { async: true });
  response.send({ message: "Stop Script Triggered!!" });
});

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


// Functions
function isValidJSONString(value) {
  try {
    JSON.parse(value);
  }
  catch (err) {
    return false;
  }
  return true;
}

function constructShellCommand(config) {
  cmd = "";
  for (const [key, value] of Object.entries(config)) {
    if (typeof (value) === "boolean") {
      if (value)
        cmd += " --" + key.toString();
    }
    else {
      cmd += " --" + key.toString() + " " + value.toString()
    }
  }
  return cmd;
}