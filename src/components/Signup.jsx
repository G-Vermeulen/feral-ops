import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// A curated list so "username" stays on-theme and validates client-side.
// Not exhaustive — just needs to feel generous, not restrictive.
const ANIMAL_NAMES = new Set([
  'wolf','fox','bear','lynx','otter','badger','raven','hawk','falcon','eagle',
  'owl','crow','heron','kestrel','osprey','viper','cobra','python','adder',
  'panther','tiger','lion','leopard','cheetah','jaguar','puma','cougar',
  'lemur','ferret','weasel','stoat','mink','marten','wolverine','hyena',
  'jackal','coyote','dingo','mongoose','meerkat','otterhound','beaver',
  'boar','stag','elk','moose','bison','buffalo','ram','ibex','gazelle',
  'antelope','impala','oryx','wildebeest','zebra','rhino','hippo','elephant',
  'giraffe','camel','llama','alpaca','yak','ox','bull','mule','donkey',
  'shark','orca','dolphin','narwhal','seal','walrus','otter2','manta',
  'stingray','eel','pike','marlin','swordfish','barracuda','piranha',
  'octopus','squid','crab','lobster','scorpion','mantis','beetle','hornet',
  'wasp','spider','tarantula','cicada','dragonfly','moth','locust',
  'sparrow','robin','wren','finch','swallow','swift','magpie','jay',
  'woodpecker','kingfisher','pelican','stork','crane','flamingo','peacock',
  'pheasant','quail','grouse','partridge','vulture','condor','buzzard',
  'kite','harrier','merlin','goshawk','sparrowhawk','barnowl','snowyowl',
  'tawnyowl','nightjar','cuckoo','swan','goose','duck','teal','mallard',
  'gannet','albatross','petrel','tern','gull','cormorant','puffin',
  'penguin','iguana','gecko','chameleon','monitor','komodo','crocodile',
  'alligator','caiman','turtle','tortoise','terrapin','frog','toad',
  'salamander','newt','axolotl','mudskipper','pangolin','armadillo',
  'sloth','anteater','tapir','capybara','chinchilla','marmot','groundhog',
  'squirrel','chipmunk','hare','rabbit','hedgehog','shrew','vole','mole',
  'bat','possum','opossum','kangaroo','wallaby','koala','wombat','quoll',
  'platypus','echidna','dragon','griffin','phoenix','basilisk','wyvern',
  'chimera','hydra','manticore','kraken','sphinx','pegasus','unicorn',
]);

function synthEmail(username) {
  return `${username.toLowerCase()}@feral-ops.local`;
}

export default function Signup({ onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const cleaned = username.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!cleaned) {
      setError('Choose a username.');
      return;
    }
    if (!ANIMAL_NAMES.has(cleaned)) {
      setError('Pick an animal name — e.g. Fox, Otter, Falcon, Lynx, Raven.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);

    const display_name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .ilike('display_name', display_name)
      .maybeSingle();
    if (existing) {
      setError('That name is already taken — try a different animal.');
      setSaving(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: synthEmail(cleaned),
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setSaving(false);
      return;
    }

    const userId = signUpData?.user?.id;
    if (userId) {
      await supabase.from('team_members').insert({ id: userId, display_name, role: 'designer' });
    }

    setSaving(false);

    if (!signUpData?.session) {
      setError(
        'Account created, but sign-in confirmation is still required on the server — ask the owner to disable email confirmations in Supabase.'
      );
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="mark" aria-hidden="true" />
        <h1>Join the Party</h1>
        <p>Pick an animal name and a password — that's it.</p>

        <label>
          Animal Name
          <input
            type="text"
            placeholder="e.g. Fox, Otter, Raven"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create Account & Enter'}
        </button>

        <p className="login-hint">
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
            Sign in instead
          </a>
        </p>
      </form>
    </div>
  );
}
