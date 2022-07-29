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
    callback(null, file.originalname)
  }
});
var upload = multer({storage: storage})

// To handle JSON data & form data in APIs. 
app.use(express.json());
app.use(express.urlencoded({extended: true}));

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
  fs.mkdir("./resources/compute-homography", {recursive: true}, no_op);
  // Write the image & map points onto respective json files. 
  // WriteFile vs WriteFileSync
  fs.writeFileSync("./resources/compute-homography/image_points.json", JSON.stringify({ "points": request.body["image-points"] }))
  fs.writeFileSync("./resources/compute-homography/map_points.json", JSON.stringify({ "points": request.body["map-points"] }))

  // Complete homography.py script execution
  shell.exec("python3 ./resources/homography.py --mode compute_homography --image_points_path ./resources/compute-homography/image_points.json --map_points_path ./resources/compute-homography/map_points.json --output_dir ./resources/compute-homography", {async: false});

  // TODO: Error Handling of File-writes
  // TODO: Error handling of shelljs exec. 
  
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
    response.status(300).send({error: error_obj});
    return;
  }

  if(!request.file.mimetype.includes("image")) {
    error_obj = {
      "message": "Please upload an image! Other file types are not supported.",
      "code": 400
    };
    response.status(400).send({error: error_obj});
    return;
  }

  // Error handling for image-points data in request body
  if (!isValidJSONString(request.body.data)) {
    error_obj = {
      "message": "Please send image points data as a valid JSON!",
      "code": 400
    };
    response.status(400).send({error: error_obj});
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

  // Save the incoming image points in the visualize-homography directory
  image_points = JSON.parse(request.body.data)["image-points"];
  fs.mkdir("./resources/visualize-homography", {recursive: true}, no_op);
  fs.writeFileSync("./resources/visualize-homography/image_points.json", JSON.stringify({ "points": image_points }))

  // Trigger the visualization script. 
  shell.exec("python3 ./resources/homography.py --mode apply_homography --image_points_path ./resources/visualize-homography/image_points.json --homography_path ./resources/compute-homography/homography_matrix.npy --frame_path ./resources/uploads/ground_frame.png --map_path ./resources/visualize-homography/cricket_map.png --output_dir ./resources/visualize-homography", {async: false});

  response_obj = {
    "message": "Execution completed!!",
    "resources": {
      "stitched_image_url": "/public/annotated_stitched_image.png"
    }
  }
  response.send(response_obj);
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