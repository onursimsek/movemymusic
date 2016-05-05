var APP_URL = 'http://3m.dev';
var STORAGE_KEY = 'move-my-music';

var moveMyMusicStorage = {
    get: function () {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    },
    set: function (object) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(object));
    }
};

var deezerMixin = {
    methods: {
        deezerInit: function () {
            DZ.init({
                appId: '163985',
                channelUrl: APP_URL + '/channel.html'
            });
        },
        deezerLogin: function () {
            var that = this;

            that.deezerInit();

            DZ.login(function (response) {
                if (!response.status || !response.authResponse) {
                    console.log('User cancelled login or did not fully authorize.');
                    that.loginError = 'No access!';
                    return false;
                }

                that.deezer.status = true;
                that.deezer.response = response;
                that.deezer.accessToken = response.authResponse.accessToken;

                moveMyMusicStorage.set(JSON.parse(JSON.stringify(that.$data)));
            }, {perms: 'basic_access,email'});
        },
        deezerLoginStatus: function () {
            var that = this;
            if (that.deezer.status) {
                that.deezerInit();

                DZ.getLoginStatus(function (response) {
                    if (!response.authResponse) {
                        that.deezer.status = false;
                    }
                });
            }
        },
        getDeezerPlaylist: function (type) {
            var that = this;
            DZ.api('user/me/playlists', 'GET', function (response) {
                response.data.forEach(function (r) {
                    that[type].playlists.push({
                        id: r.id,
                        title: r.title,
                        picture: r.picture_big,
                        tracks: r.nb_tracks
                    });
                });
            });
        }
    }
};

var spotifyMixin = {
    methods: {
        spotifyLogin: function () {
            var clientId = 'b8a1908692314b44852927d11ff15234';

            var src = 'https://accounts.spotify.com/authorize?';
            var arg = [];
            arg.push('client_id=' + clientId);
            arg.push('redirect_uri=' + encodeURIComponent(APP_URL));
            arg.push('response_type=token');
            arg.push('scope=user-library-read');

            document.location = src + arg.join('&');
        },
        getSpotifyPlaylist: function (type) {
            var that = this;
            this.spotifyCall(this.spotify.api + '/me/playlists', function (playlists) {
                playlists.items.forEach(function (r) {
                    that[type].playlists.push({
                        id: r.id,
                        title: r.name,
                        picture: r.images[0].url,
                        tracks: r.tracks.total
                    });
                })
            });
        },
        spotifyCall: function (url, callback, method) {
            var method = method || 'get';

            Vue.http.headers.common['Authorization'] = 'Bearer ' + this.spotify.accessToken;

            this.$http({url: url, method: method}).then(function (response) {
                callback(response.data);
            });
        }
    }
};

new Vue({
    el: '.moveMyMusicApp',
    data: Object.assign({
        source: {
            name: 'deezer',
            playlists: [],
            tracks: []
        },
        target: {
            name: 'spotify',
            playlists: [],
            tracks: []
        },
        providers: [
            {text: 'Deezer', value: 'deezer'},
            {text: 'Spotify', value: 'spotify'}
        ],
        loginError: '',
        deezer: {
            status: false,
            accessToken: '',
            response: {}

        },
        spotify: {
            api: 'https://api.spotify.com/v1',
            status: false,
            accessToken: '',
            response: {}
        }
    }, moveMyMusicStorage.get()),
    mixins: [deezerMixin, spotifyMixin],
    ready: function () {
        var that = this;
        var args = parseArgs();

        if ('access_token' in args) {
            that.spotify.status = true;
            that.spotify.response = args;
            that.spotify.accessToken = args['access_token'];

            moveMyMusicStorage.set(JSON.parse(JSON.stringify(that.$data)));
        }

        this.deezerLoginStatus();
    },
    methods: {
        loginStatus: function (provider) {
            return typeof this[provider].status != 'undefined' ? this[provider].status : false;
        },
        login: function (provider) {
            switch (provider) {
                case 'deezer':
                    this.deezerLogin();
                    break;
                case 'spotify':
                    this.spotifyLogin();
                    break;
                default:
                    this.loginError = 'Not accepted!';
                    return false;
            }
        },
        fetchPlaylist: function () {
            this.getPlaylist(this.source.name, 'source');
            this.getPlaylist(this.target.name, 'target');
        },
        getPlaylist: function (provider, type) {
            switch (provider) {
                case 'deezer':
                    this.getDeezerPlaylist(type);
                    break;
                case 'spotify':
                    this.getSpotifyPlaylist(type);
                    break;
                default:
                    return false;
            }
        }
    }
});

function parseArgs() {
    var hash = location.hash.replace(/#/g, '');
    var all = hash.split('&');
    var args = {};
    all.forEach(function (keyvalue) {
        var kv = keyvalue.split('=');
        var key = kv[0];
        var val = kv[1];
        args[key] = val;
    });
    return args;
}
