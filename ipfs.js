'use strict'
const ipfs = new Ipfs({
    EXPERIMENTAL: {
        pubsub: true
    }
})

const unique_key = 'ASHDUIH213G17DG17G2D7G21';
let gallery;

var data_object = {}
data_object.comments_array = {}
data_object.images_array = {}

var counter = 0;

ipfs.once('ready', () => {



    var parser = document.createElement('a');
    parser.href = window.location.href

    if (parser.search) {
        var peer_to_connect = parser.search.substring(1);
        document.getElementById('peer_id').value = decodeURI(peer_to_connect);
        connectToPeer(document.getElementById('connect_button'));
    }

    if (parser.hash) {
        var data_object_hash = parser.hash.substring(1);
        loadDataObject(data_object_hash);
    }

    ipfs.id(function (err, identity) {
        if (err) {
            throw err
        }
        document.getElementById("username").value = identity.addresses[0];
        document.getElementById("my_id").value = identity.addresses[0];
    })

    ipfs.pubsub.subscribe(unique_key + 'exchanged-files', (message) => {

        const data = message.data.toString()
        let image = JSON.parse(data);
        const hash = image.hash;

        if (data_object.images_array[hash]) {
            data_object.images_array[hash].push(image)
        } else {
            data_object.images_array[hash] = new Array()
            data_object.images_array[hash] = [image]
        }

        ipfs.files.cat(hash, function (err, stream) {

            var response = []
            stream.on('data', function (chunk) {
                response.push(chunk)
            })

            stream.on('end', function () {

                let comments = '<div id=\'comments_' + hash + '\'></div>\
                    <input id=\'input_' + hash + '\' type=\'text\' placeholder=\'Comment...\'>\
                    <button onclick=\'sendComment(`' + hash + '`)\'>Send</button>';

                var blob = new Blob(response, { type: "image/jpeg" });
                var urlCreator = window.URL || window.webkitURL;
                var imageUrl = urlCreator.createObjectURL(blob);

                document.getElementById("lightgallery").innerHTML += '<li data-hash="' + hash + '" data-responsive="' + imageUrl + ' 375" data-src="' + imageUrl + '"\
                data-sub-html="'+ comments + '">\
                <a href="">\
                    <img class="img-responsive" src="'+ imageUrl + '">\
                    <div class="demo-gallery-poster">\
                    <img src="https://sachinchoolur.github.io/lightgallery.js/static/img/zoom.png">\
                    </div>\
                </a>\
                </li>';

                var lg = document.getElementById('lightgallery');
                lightGallery(lg)

                lg.addEventListener('onAfterAppendSubHtml', function (e, a, aa) {
                    if (counter == 0) {
                        var id = e.target.children[e.detail.index].dataset.hash;
                        if (data_object.comments_array[id]) {
                            let comm_box = document.getElementById('comments_' + id);
                            if (comm_box) {
                                data_object.comments_array[id].forEach(function (v) {

                                    comm_box.innerHTML += "<b>" + v.username + ": </b>" + v.comment + '<hr>';

                                });
                            }

                        }
                        document.getElementById('input_' + id).addEventListener("keyup", function (event) {
                            event.preventDefault();
                            if (event.keyCode === 13) {
                                sendComment(id);
                            }
                        });
                    }
                    counter++;

                }, false);

                lg.addEventListener('onBeforeSlide', function (e, a, aa) {
                    counter = 0;
                }, false);

            })
        })
    })

    ipfs.pubsub.subscribe(unique_key + 'comments', (message) => {

        const data = message.data.toString()
        let comment = JSON.parse(data);

        if (data_object.comments_array[comment.id]) {
            data_object.comments_array[comment.id].push(comment)
        } else {
            data_object.comments_array[comment.id] = new Array()
            data_object.comments_array[comment.id] = [comment]
        }

        if (document.getElementById('comments_' + comment.id)) {
            document.getElementById('comments_' + comment.id).innerHTML += "<b>" + comment.username + ": </b>" + comment.comment + '<hr>';
        }
    });

    var input = document.getElementById("files"),
        fileData;

    function openfile(evt) {
        var files = input.files;
        fileData = new Blob([files[0]]);
        var promise = new Promise(getBuffer);
        promise.then(function (data) {
            upload(data);
        }).catch(function (err) {
            console.log('Error: ', err);
        });
    }

    function upload(toStore) {
        const Buffer = ipfs.types.Buffer
        const filetoadd = new Buffer(toStore)
        ipfs.files.add(filetoadd, function (err, res) {
            if (err || !res) return console.error("ipfs add error", err, res);
            const file = res[0]
            var imageObj = JSON.stringify({
                hash: file.hash,
                username: document.getElementById("username").value
            })
            //data_object.images_array.push()
            ipfs.pubsub.publish(unique_key + 'exchanged-files', Buffer.from(imageObj), (err) => {
                if (err) {
                    console.error('error publishing: ', err)
                } else {
                    //console.log('successfully published message')
                }
            })

        });
    }

    /* 
      Create a function which will be passed to the promise
      and resolve it when FileReader has finished loading the file.
    */
    function getBuffer(resolve) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(fileData);
        reader.onload = function () {
            var arrayBuffer = reader.result
            var bytes = new Uint8Array(arrayBuffer);
            resolve(bytes);
        }
    }

    // Eventlistener for file input.
    input.addEventListener('change', openfile, false);



})

function createLink() {
    let swarm = document.getElementById("my_id").value;
    const Buffer = ipfs.types.Buffer
    ipfs.files.add(Buffer.from(JSON.stringify(data_object)), function (err, res) {
        if (err || !res) return console.error("ipfs add error", err, res);
        const file = res[0]

        var parser = document.createElement('a');
        parser.href = window.location.href

        let url = parser.protocol + '//' + parser.hostname + parser.port + parser.pathname + "?" + encodeURI(swarm) + "#" + encodeURI(file.hash)
    
        document.getElementById("url").value = url;

    });

   
}

function connectToPeer(event) {
    let connectPeer = document.getElementById('peer_id');
    event.disabled = true
    ipfs.swarm.connect(connectPeer.value, (err) => {
        if (err) {
            return err
        }
        console.log("connected");
        connectPeer.value = ''

        setTimeout(() => {
            event.disabled = false
        }, 500)
    })
}

function sendComment(hash) {
    const Buffer = ipfs.types.Buffer

    let comment = document.getElementById('input_' + hash).value;

    let commentObj = JSON.stringify({
        id: hash,
        comment: comment,
        username: document.getElementById("username").value
    });

    ipfs.pubsub.publish(unique_key + 'comments', Buffer.from(commentObj), (err) => {
        if (err) {
            console.error('error publishing: ', err)
        } else {
            document.getElementById('input_' + hash).value = "";
        }
    })
}

function cloneRoom() {
    const Buffer = ipfs.types.Buffer

    ipfs.files.add(Buffer.from(JSON.stringify(data_object)), function (err, res) {
        if (err || !res) return console.error("ipfs add error", err, res);
        const file = res[0]

        var parser = document.createElement('a');
        parser.href = window.location.href

        let url = parser.protocol + '//' + parser.hostname + parser.port + parser.pathname + "#" + encodeURI(file.hash)

        document.getElementById("url_clone").value = url;

    });
}

function loadDataObject(data_object_hash) {
    ipfs.files.cat(data_object_hash, function (err, stream) {
        var response = ""
        stream.on('data', function (chunk) {
            response += chunk.toString()
        })

        stream.on('end', function () {
            data_object = JSON.parse(response)

            for( var hash in data_object.images_array) {
            //data_object.images_array[Object.keys(data_object.images_array)[0]].forEach(function (element) {

                
                ipfs.files.cat(hash, function (err, stream1) {

                    var response = []
                    stream1.on('data', function (chunk) {
                        response.push(chunk)
                    })

                    stream1.on('end', function () {

                        let comments = '<div id=\'comments_' + hash + '\'></div>\
                                        <input id=\'input_' + hash + '\' type=\'text\' placeholder=\'Comment...\'>\
                                        <button onclick=\'sendComment(`' + hash + '`)\'>Send</button>';

                        var blob = new Blob(response, { type: "image/jpeg" });
                        var urlCreator = window.URL || window.webkitURL;
                        var imageUrl = urlCreator.createObjectURL(blob);

                        document.getElementById("lightgallery").innerHTML += '<li data-hash="' + hash + '" data-responsive="' + imageUrl + ' 375" data-src="' + imageUrl + '"\
                                    data-sub-html="'+ comments + '">\
                                    <a href="">\
                                        <img class="img-responsive" src="'+ imageUrl + '">\
                                        <div class="demo-gallery-poster">\
                                        <img src="https://sachinchoolur.github.io/lightgallery.js/static/img/zoom.png">\
                                        </div>\
                                    </a>\
                                    </li>';

                        var lg = document.getElementById('lightgallery');
                        lightGallery(lg)

                        lg.addEventListener('onAfterAppendSubHtml', function (e, a, aa) {
                            if (counter == 0) {
                                var id = e.target.children[e.detail.index].dataset.hash;
                                if (data_object.comments_array[id]) {
                                    let comm_box = document.getElementById('comments_' + id);
                                    if (comm_box) {
                                        data_object.comments_array[id].forEach(function (v) {

                                            comm_box.innerHTML += "<b>" + v.username + ": </b>" + v.comment + '<hr>';

                                        });
                                    }

                                }
                                document.getElementById('input_' + id).addEventListener("keyup", function (event) {
                                    event.preventDefault();
                                    if (event.keyCode === 13) {
                                        sendComment(id);
                                    }
                                });
                            }
                            counter++;

                        }, false);

                        lg.addEventListener('onBeforeSlide', function (e, a, aa) {
                            counter = 0;
                        }, false);

                    })
                })
            }
        })

    })
}