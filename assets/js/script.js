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
        me: new Me(),
        playlists: [],
        tracks: []
    },
    ready: function () {
        this.getLoginStatus();
    },
    watch: {
        /**
         * Yeni değer için şarkı listesini al
         */
        playlists: {
            handler: function (val, oldVal) {
                var newPlaylist = val.filter(function (r) {
                    return !r.sync
                })[0];

                this.setPlaylist(newPlaylist);
                newPlaylist.getTracks().map(function (r) {
                    this.findTrack(r);
                });
                this.setPlaylistTracks(newPlaylist);
            },
            deep: true
        }
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
                that.me.setId(response.id)
                    .setUsername(response.name)
                    .setAvatar(response.picture_big);
            });
        },
        getPlaylists: function () {
            var that = this;
            that.playlists = [];
            DZ.api('user/me/playlists', 'GET', function (response) {
                response.data.forEach(function (r) {
                    that.playlists.push(
                        new Playlist()
                            .setId(r.id)
                            .setTitle(r.title)
                            .setPicture(r.picture_big)
                    );
                });
            });
        },
        getPlaylist: function (playlistId) {
            return this.playlists.filter(function (r) {
                return r.getId() == playlistId;
            })[0];
        },
        setPlaylist: function (playlist) {
            DZ.api('user/me/playlists', 'POST', {title: playlist.getTitle()}, function (response) {
                console.log('Playlist created for deezer: ' + response.id);
                playlist.setId(response.id).setSync(true);
            });
        },
        getPlaylistTracks: function (playlistId) {
            var playlist = this.getPlaylist(playlistId);
            DZ.api('playlist/' + playlist.getId() + '/tracks', 'GET', function (response) {
                response.data.forEach(function (r) {
                    playlist.setTracks(
                        new Track()
                            .setId(r.id)
                            .setTitle(r.title)
                            .setArtist(
                                new Artist()
                                    .setId(r.artist.id)
                                    .setName(r.artist.name)
                                    .setPicture(r.artist.picture_big)
                            )
                            .setAlbum(
                                new Album()
                                    .setId(r.album.id)
                                    .setTitle(r.album.title)
                                    .setCover(r.album.cover_big)
                            )
                    );
                })
            });
        },
        setPlaylistTracks: function (playlist) {
            var trackList = [];
            playlist.getTracks().forEach(function (r) {
                if (r.getSync()) {
                    trackList.push(r.getId());
                }
            });

            DZ.api('playlist/' + playlist.getId() + '/tracks', {songs: trackList.join(',')}, function (response) {
                console.log('Added tracks to playlist');
                playlist.setSync(true);
            });
        },
        findTrack: function (track) {
            DZ.api('search/track', 'GET', {q: track.getTitle() + ' ' + track.getArtist().getName()}, function (response) {
                if (!response.data.length) {
                    console.log(track.getTitle() + ' track is not found on ' + app.target.name);
                    track.setSync(false);
                }

                track.setId(response.data[0].id);
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
    watch: {
        /**
         * Yeni değer için şarkı listesini al
         */
        playlists: {
            handler: function (val, oldVal) {
                var newPlaylist = val.filter(function (r) {
                    return !r.sync
                })[0];

                this.setPlaylist(newPlaylist);
                newPlaylist.getTracks().map(function (r) {
                    this.findTrack(r);
                });
                this.setPlaylistTracks(newPlaylist);
            },
            deep: true
        }
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
                    that.playlists.push(
                        new Playlist()
                            .setId(r.id)
                            .setTitle(r.name)
                            .setPicture(r.images[0].url)
                    );
                })
            });
        },
        getPlaylist: function (playlistId) {
            return this.playlists.filter(function (r) {
                return r.getId() == playlistId;
            })[0];
        },
        setPlaylists: function (playlist) {
            this.call('/users/' + this.me.getId() + '/playlists', {name: title, public: true}, function (response) {
                console.log('Playlist created for spotify: ' + response.id);
                playlist.setId(response.id).setSync(true);
            }, 'post');
        },
        getPlaylistTracks: function (playlistId) {
            var playlist = this.getPlaylist(playlistId);
            this.call('/users/' + this.me.getId() + '/playlists/' + playlistId + '/tracks', function (response) {
                response.items.forEach(function (r) {
                    playlist.setTracks(
                        new Track()
                            .setId(r.id)
                            .setTitle(r.title)
                            .setArtist(
                                new Artist()
                                    .setId(r.artists[0].id)
                                    .setName(r.artists[0].name)
                                    .setPicture('')
                            )
                            .setAlbum(
                                new Album()
                                    .setId(r.album.id)
                                    .setTitle(r.album.title)
                                    .setCover(r.album.images[0].url)
                            )
                    );
                });
            });
        },
        setPlaylistTracks: function (playlist) {
            var trackList = [];
            playlist.getTracks().forEach(function (r) {
                if (r.getSync()) {
                    trackList.push('spotify:track' + r.getId());
                }
            });

            this.call('/users/' + this.me.getId() + '/playlists/' + playlist.getId() + '/tracks', {uris: trackList.join(',')}, function (response) {
                console.log('Added tracks to playlist');
                playlist.setSync(true);
            });
        },
        findTrack: function (track) {
            this.call('/search', {q: track.getTitle(), type: 'track'}, function (response) {
                if (!response.tracks.items.length) {
                    console.log(track.getTitle() + ' track is not found on ' + app.target.name);
                    track.setSync(false);
                }

                track.setId(response.tracks.items[0].id);
            })
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
            globalThat[provider].getLogin();
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
            globalThat[provider].getPlaylists(provider, type);
        },
        movePlaylist: function (playlistId) {
            var playlist = [];

            // TODO: Kaynak playlist'inin şarkı listesini çek
            globalThat[this.source.name].getPlaylistTracks(playlistId);
            // TODO: Kaynaktan playlist'i bul
            playlist = globalThat[this.source].getPlaylist(playlistId);
            // TODO: Playlist'i hedef playlist'lerine ekle şarkı listesi ile birlikte (sync:false)
            globalThat[this.target.name].playlists.push(playlist);
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

function Playlist() {
    this.id = null;
    this.title = '';
    this.picture = '';

    var sync = true,
        tracks = [];

    this.getId = function () {
        return this.id;
    };
    this.setId = function (id) {
        this.id = id;
    };
    this.getTitle = function () {
        return this.title;
    };
    this.setTitle = function (title) {
        this.title = title;
    };
    this.getPicture = function () {
        return this.picture;
    };
    this.setPicture = function (picture) {
        this.picture = picture;
    };
    this.getTracks = function () {
        return tracks;
    };
    this.setTracks = function (tracks) {
        tracks.push(tracks);
    };
    this.getTracksCount = function () {
        return tracks.length;
    };
    this.getSync = function () {
        return sync;
    };
    this.setSync = function (arg) {
        sync = arg;
    }
}

function Track() {
    this.id = null;
    this.title = '';
    this.artist = {};
    this.album = {};

    var isLocal = false,
        sync = true;

    this.getId = function () {
        return this.id;
    };
    this.setId = function (id) {
        this.id = id;
    };
    this.getTitle = function () {
        return this.title;
    };
    this.setTitle = function (title) {
        this.title = title;
    };
    this.getArtist = function () {
        return this.artist;
    };
    this.setArtist = function (artist) {
        this.artist = artist;
    };
    this.getAlbum = function () {
        return this.album;
    };
    this.setAlbum = function (album) {
        this.album = album;
    };
    this.getIsLocal = function () {
        return isLocal;
    };
    this.setIsLocal = function (local) {
        isLocal = local;
    };
    this.getSync = function () {
        return sync;
    };
    this.setSync = function (arg) {
        sync = arg;
    };
}

function Artist() {
    this.id = null;
    this.name = '';
    this.picture = '';

    this.getId = function () {
        return this.id;
    };
    this.setId = function (id) {
        this.id = id;
    };
    this.getName = function () {
        return this.name;
    };
    this.setName = function (name) {
        this.name = name;
    };
    this.getPicture = function () {
        return this.picture;
    };
    this.setPicture = function (picture) {
        this.picture = picture;
    };
}

function Album() {
    this.id = null;
    this.title = '';
    this.cover = '';

    this.getId = function () {
        return this.id;
    };
    this.setId = function (id) {
        this.id = id;
    };
    this.getTitle = function () {
        return this.title;
    };
    this.setTitle = function (title) {
        this.title = title;
    };
    this.getCover = function () {
        return this.cover;
    };
    this.setCover = function (cover) {
        this.cover = cover;
    };
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
