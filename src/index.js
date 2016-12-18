function main() {
    let renderer;
    let stage;
    let dragonbonesFactory;
    let armature;

    let dragonBonesDatas = [];
    let textures = {};

    const width = 1280;
    const height = 720;

    renderer = PIXI.autoDetectRenderer(width, height, {
        view: document.getElementById('gameCanvas')
    });

    stage = new PIXI.Container();
    PIXI.ticker.shared.add(() => renderer.render(stage));

    dragonbonesFactory = new dragonBones.PixiFactory();
    dragonbonesFactory.autoSearch = true;

    PIXI.ticker.shared.add(() => {
        dragonBones.WorldClock.clock.advanceTime(PIXI.ticker.shared.elapsedMS * 0.001);
    });

    initDropZone();
    createControl('armatures', onArmatureChange);
    createControl('animations', onAnimationChange);

    function onArmatureChange(key) {
        if (armature) {
            dragonBones.WorldClock.clock.remove(armature);
            armature.display.destroy();
            armature = null;
        }

        if (key) {
            armature = dragonbonesFactory.buildArmature(key);
            dragonBones.WorldClock.clock.add(armature);
            let anim = stage.addChild(armature.display);
            anim.x = width / 2;
            anim.y = height / 2;

            updateAnimationsList(armature.armatureData.animations);
        }
        else {
            updateAnimationsList();
        }
    }

    function onAnimationChange(key) {
        if (armature) {
            armature.animation.gotoAndPlay(key);
        }
    }

    function handleFile(file) {
        return new Promise((res, rej) => {
            let type;

            let reader = new FileReader();
            reader.onload = function(e) {
                if (type === 'json') {
                    let data = JSON.parse(e.target.result);
                    if (data.armature) {
                        dragonBonesDatas.push(data);
                    }
                    else {
                        let filename = file.name.match(/[^\\]*(?=[.][a-zA-Z]+$)/)[0];
                        textures[filename] = textures[filename] || {};
                        textures[filename].json = data;
                    }
                    res();
                }
                else if (type === 'image') {
                    let filename = file.name.match(/[^\\]*(?=[.][a-zA-Z]+$)/)[0];
                    textures[filename] = textures[filename] || {};
                    let img = new Image();
                    img.src = e.target.result;
                    textures[filename].image = img;
                    res();
                }
                else {
                    rej();
                }
            };
            if (/\.json$/.test(file.name)) {
                type = 'json';
                reader.readAsText(file);
            }
            else if (/^image\//.test(file.type)) {
                type = 'image';
                reader.readAsDataURL(file);
            }
            else {
                rej();
            }
        })
    }

    function traverseFileTree(item, path) {
        return new Promise((res, rej) => {
            path = path || '';
            if (item.isFile) {
                // Get file
                item.file(file => {
                    handleFile(file).then(res, rej);
                });
            }
            else if (item.isDirectory) {
                // Get folder contents
                let dirReader = item.createReader();

                new Promise((res, rej) => {
                    dirReader.readEntries(function(entries) {
                        let promises = [];
                        for (let i = 0; i < entries.length; ++i) {
                            promises.push(traverseFileTree(entries[i], path + item.name + '/'));
                        }
                        Promise.all(promises).then(res, rej);
                    });
                }).then(res, rej);
            }
        });
    }

    function initDropZone() {
        let control = document.body;
        control.ondrop = e => {
            e.preventDefault();

            dragonBonesDatas = [];
            textures = {};

            updateArmaturesList();

            let items = e.dataTransfer.items;
            let promises = [];

            for (let i = 0; i < items.length; ++i) {
                // webkitGetAsEntry is where the magic happens
                if (typeof items[i].webkitGetAsEntry === 'function') {
                    let item = items[i].webkitGetAsEntry();
                    if (item) {
                        promises.push(traverseFileTree(item));
                    }
                }
            }
            Promise.all(promises)
                .then(() => {
                    console.log('parse done!');
                    Object.getOwnPropertyNames(textures).forEach(key => {
                        dragonbonesFactory.parseTextureAtlasData(
                            textures[key].json,
                            new PIXI.BaseTexture(textures[key].image)
                        );
                    });

                    if (dragonBonesDatas.length) {
                        let data = dragonbonesFactory.parseDragonBonesData(dragonBonesDatas[0]);
                        updateArmaturesList(data.armatures);
                    }
                })
        };
        control.ondragover = e => {
            e.preventDefault();
        }
    }

    function createControl(name, callback) {
        let root = document.getElementById('controls');
        let control = document.createElement('select');
        control.setAttribute('name', name);
        control.setAttribute('id', name);
        control.onchange = e => callback(e.target.value);
        root.appendChild(control);

        updateList(name);
    }

    function updateList(id, elements = {}) {
        let select = document.getElementById(id);
        select.innerHTML = select.innerText = '';

        let option = (name, value) => {
            let option = document.createElement('option');
            option.setAttribute('value', value);
            option.innerHTML = option.innerText = name;
            select.appendChild(option);
        };

        option(id.toUpperCase(), '');

        Object.getOwnPropertyNames(elements).forEach(key => option(key, key));
    }

    function updateArmaturesList(armatures = {}) {
        updateList('armatures', armatures);
    }

    function updateAnimationsList(animations = {}) {
        updateList('animations', animations);
    }
}
