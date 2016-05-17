var globalThat = this;
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

var deezer = new Vue({
    el: '#deezer',
    data: {
        appId: '163985',
        channel: APP_URL + '/channel.html',
        scopes: [
            'basic_access',
            'email',
            'manage_library'
        ],
        login: {
            status: false,
            accessToken: '',
            response: {}
        },
        me: {},
        playlists: [],
        tracks: []
    },
    ready: function () {
        this.getLoginStatus();
    },
    methods: {
        init: function () {
            DZ.init({
                appId: this.appId,
                channelUrl: this.channel
            });
        },
        getLogin: function () {
            this.init();

            var that = this;
            DZ.login(function (response) {
                if (!response.status || !response.authResponse) {
                    error.setError('User cancelled login or did not fully authorize.', 'alert');
                    return false;
                }

                that.login = {
                    status: true,
                    accessToken: response.authResponse.accessToken,
                    response: response
                };

                that.getMe();
                //moveMyMusicStorage.set(JSON.parse(JSON.stringify({deezer: that.$data})));
            }, {perms: this.scopes.join(',')});
        },
        getLoginStatus: function () {
            if (this.login.status) {
                this.init();

                var that = this;
                DZ.getLoginStatus(function (response) {
                    if (!response.authResponse) {
                        that.login.status = false;
                    }
                });
            }
        },
        getMe: function () {
            var that = this;
            DZ.api('/user/me', 'GET', function (response) {
                that.me = {
                    id: response.id,
                    username: response.name,
                    avatar: response.picture_big
                };
            });
        },
        getPlaylists: function () {
            var that = this;
            that.playlists = [];
            DZ.api('user/me/playlists', 'GET', function (response) {
                response.data.forEach(function (r) {
                    that.playlists.push({
                        id: r.id,
                        title: r.title,
                        picture: r.picture_big,
                        tracks: r.nb_tracks
                    });
                });
            });
        },
        setPlaylists: function (title, tracks) {
            DZ.api('user/me/playlists', 'POST', {title: title}, function (response) {
                console.log('Playlist created for deezer: ' + response.id);
                DZ.api('playlist/' + response.id + '/tracks', {songs: tracks}, function (response) {
                    console.log('Added tracks to playlist');
                });
            });
        }
    }
});

var spotify = new Vue({
    el: '#spotify',
    data: {
        apiUrl: 'https://api.spotify.com/v1',
        appId: 'b8a1908692314b44852927d11ff15234',
        callback: APP_URL,
        scopes: [
            'user-read-private',
            'playlist-read-private',
            'playlist-modify-public',
            'playlist-modify-private',
            'user-library-read',
            'user-library-modify'
        ],
        login: {
            status: false,
            accessToken: '',
            refreshToken: '',
            response: {}
        },
        me: {},
        playlists: [],
        tracks: []
    },
    ready: function () {
        this.getLoginStatus();
    },
    methods: {
        call: function (url, data, callback, method) {
            var method = method || 'get';

            Vue.http.headers.common['Authorization'] = 'Bearer ' + this.login.accessToken;

            this.$http({
                url: this.apiUrl + url,
                method: method,
                data: data
            }).then(function (response) {
                callback(response.data);
            }, function () {
                this.refreshToken();
            });
        },
        getLogin: function () {
            var src = 'https://accounts.spotify.com/authorize?';
            var arg = [];
            arg.push('client_id=' + this.appId);
            arg.push('redirect_uri=' + this.callback);
            arg.push('response_type=token');
            arg.push('scope='.this.scopes.join(','));

            document.location = src + arg.join('&');
        },
        getLoginStatus: function () {
            var args = parseArgs();

            if ('access_token' in args) {
                this.login = {
                    status: true,
                    response: args,
                    accessToken: args['access_token']
                };

                this.getMe();

                //this.getRefreshToken();

                //moveMyMusicStorage.set(JSON.parse(JSON.stringify(that.$data)));

                document.location = '/';
            }
        },
        getMe: function () {
            var that = this;
            this.call('/me', {}, function (me) {
                that.me = {
                    id: me.id,
                    username: me.display_name,
                    avatar: me.images.length ? me.images[0].url : null
                };
            });
        },
        getPlaylists: function () {
            var that = this;
            that.playlists = [];
            this.call('/me/playlists', {}, function (playlists) {
                playlists.items.forEach(function (r) {
                    that.playlists.push({
                        id: r.id,
                        title: r.name,
                        picture: r.images[0].url,
                        tracks: r.tracks.total
                    });
                })
            });
        },
        setPlaylists: function (title, tracks, public) {
            var public = public || true;
            var that = this;
            this.call('/users/' + this.me.id + '/playlists', {name: title, public: public}, function (playlist) {
                that.call('/users/' + that.me.id + '/playlists/' + playlist.id + '/tracks', {uris: tracks}, function () {

                }, 'post');
            }, 'post');
        },
        setRefreshToken: function () {
            Vue.http.headers.common['Authorization'] = 'Basic ' + btoa(this.appId + 'd7a5703c5e7c4cae87f8aff3fcd1c417');

            this.$http.post(
                'https://accounts.spotify.com/api/token',
                {
                    grant_type: 'authorization_code',
                    code: this.login.accessToken,
                    redirect_uri: this.callback
                },
                function (response) {
                    this.login.accessToken = response.auth_token;
                    this.login.refreshToken = response.refresh_token;
                    this.login.response = response;
                }
            );
        },
        refreshToken: function () {
            Vue.http.headers.common['Authorization'] = 'Basic ' + btoa(this.appId + 'd7a5703c5e7c4cae87f8aff3fcd1c417');

            this.$http({
                url: 'https://accounts.spotify.com/api/token',
                method: 'post',
                data: {
                    grant_type: 'authorization_code',
                    refresh_token: this.login.refreshToken
                }
            }).then(function (response) {
                this.login.accessToken = response.auth_token;
                this.login.response = response;
            });
        }
    }
});

var app = new Vue({
    el: '.moveMyMusicApp',
    data: {
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
        tmp: {},
        providers: [
            {text: 'Deezer', value: 'deezer'},
            {text: 'Spotify', value: 'spotify'}
        ],
        errors: []
    },
    methods: {
        loginStatus: function (provider) {
            return typeof globalThat[provider].login.status != 'undefined' ? globalThat[provider].login.status : false;
        },
        login: function (provider) {
            switch (provider) {
                case 'deezer':
                    deezer.getLogin();
                    break;
                case 'spotify':
                    this.spotifyLogin();
                    break;
                default:
                    this.loginError = 'Not accepted!';
                    return false;
            }
        },
        sourceChange: function () {
            this.source.playlists = [];
            this.source.tracks = [];
        },
        targetChange: function () {
            this.target.playlists = [];
            this.target.tracks = [];
        },
        changeDirection: function () {
            this.tmp = this.source;
            this.source = this.target;
            this.target = this.tmp;
        },
        fetchPlaylist: function () {
            this.getPlaylists(this.source.name, 'source');
            this.getPlaylists(this.target.name, 'target');
        },
        getPlaylists: function (provider, type) {
            switch (provider) {
                case 'deezer':
                    this.getDeezerPlaylists();
                    break;
                case 'spotify':
                    this.getSpotifyPlaylists();
                    break;
                default:
                    return false;
            }
        },
        movePlaylist: function (playlist) {

        }
    }
});

var error = new Vue({
    data: {
        errors: []
    },
    methods: {
        getError: function () {
            return this.errors;
        },
        setError: function (text, type) {
            this.errors.push({
                text: text,
                type: type
            });
        }
    }
});

function Me() {
    this.id = '';
    this.username = '';
    this.avatar = '';
    this.getId = function () {
        return this.id;
    };
    this.setId = function (id) {
        this.id = id;
    };
    this.getUsername = function () {
        return this.username;
    };
    this.setUsername = function (username) {
        this.username = username;
    };
    this.getAvatar = function () {
        return this.avatar;
    };
    this.setAvatar = function (avatar) {
        this.avatar = avatar;
    }
}

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
