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

new Vue({
    el: '.moveMyMusicApp',
    data: Object.assign({
        source: 'deezer',
        target: 'spotify',
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
            status: false,
            accessToken: '',
            response: {}
        }
    }, moveMyMusicStorage.get()),
    created: function () {
        var args = parseArgs();

        if ('access_token' in args) {
            this.spotify.status = true;
            this.spotify.response = args;
            this.spotify.accessToken = args['access_token'];
        }
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
        deezerLogin: function () {
            var that = this;

            DZ.init({
                appId: '163985',
                channelUrl: APP_URL + '/channel.html'
            });

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
        spotifyLogin: function () {
            var clientId = 'b8a1908692314b44852927d11ff15234';

            var src = 'https://accounts.spotify.com/authorize?';
            var arg = [];
            arg.push('client_id=' + clientId);
            arg.push('redirect_uri=' + encodeURIComponent(APP_URL));
            arg.push('response_type=token');
            arg.push('scope=user-library-read');

            document.location = src + arg.join('&');
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