const jsmediatags = window.jsmediatags;

const id = window.location.href.substr(1 + window.location.href.lastIndexOf("/"));
jsmediatags.read(`https://hololive-resistance.s3.nl-ams.scw.cloud/${id}.mp3`, {
    onSuccess: function (tag) {
        if(tag.tags.picture) {
            const image = tag.tags.picture;
            let base64String = "";
            for (let i = 0; i < image.data.length; i++) {
                base64String += String.fromCharCode(image.data[i]);
            }
            let base64 = "data:image/jpeg;base64," +
                window.btoa(base64String);
            document.getElementById('player').style.backgroundImage = `url(${base64})`;
        }
    }
});